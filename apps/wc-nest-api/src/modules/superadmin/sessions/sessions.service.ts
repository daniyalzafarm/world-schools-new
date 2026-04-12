import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { parse } from 'csv-parse/sync'
import { PrismaService } from '../../../prisma/prisma.service'
import { parseSessionCsvRow, validateSessionCsvRow } from './sessions-csv.helpers'

export interface ImportSessionRowError {
  column: number
  name: string
  reason: string
}

export interface ImportSessionsResult {
  imported: number
  failed: number
  errors: ImportSessionRowError[]
}

@Injectable()
export class SuperAdminSessionsService {
  private readonly logger = new Logger(SuperAdminSessionsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async importFromCsv(
    fileBuffer: Buffer,
    campId: string,
    providerId: string
  ): Promise<ImportSessionsResult> {
    // Verify camp exists and belongs to the provider
    const camp = await this.prisma.camp.findUnique({
      where: { id: campId },
      select: { id: true, providerId: true, type: true },
    })

    if (!camp) {
      throw new NotFoundException(`Camp with ID '${campId}' not found`)
    }

    if (camp.providerId !== providerId) {
      throw new NotFoundException(`Camp with ID '${campId}' not found for this provider`)
    }

    // Parse CSV — column-oriented: first column = field key, each subsequent column = one session
    let rawRows: string[][]
    try {
      rawRows = parse(fileBuffer, {
        columns: false,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as string[][]
    } catch {
      throw new Error('Failed to parse CSV file. Please ensure it is a valid CSV.')
    }

    const numSessions = rawRows.length > 0 ? rawRows[0].length - 1 : 0

    if (numSessions === 0) {
      return { imported: 0, failed: 0, errors: [] }
    }

    // Check existing session count against the 50-session limit
    const existingCount = await this.prisma.session.count({ where: { campId } })

    if (existingCount >= 50) {
      throw new Error(
        `This camp already has ${existingCount} sessions — the maximum allowed is 50. No sessions were imported.`
      )
    }

    const maxToImport = 50 - existingCount
    if (numSessions > maxToImport) {
      throw new Error(
        `This camp has ${existingCount} existing sessions. You can import at most ${maxToImport} more (maximum is 50 per camp), but the file contains ${numSessions}.`
      )
    }

    // Transpose column-oriented → row objects
    const rows: Record<string, string>[] = Array.from({ length: numSessions }, (_, p) => {
      const record: Record<string, string> = {}
      for (const rawRow of rawRows) {
        const key = rawRow[0] ?? ''
        record[key] = rawRow[p + 1] ?? ''
      }
      return record
    })

    // Fetch existing sessions for overlap detection
    const existingSessions = await this.prisma.session.findMany({
      where: { campId },
      select: { startDate: true, endDate: true, name: true },
    })

    // Track sessions created in this batch for intra-batch overlap detection
    const createdInBatch: { startDate: Date; endDate: Date }[] = []

    // Get max sortOrder for auto-increment
    const lastSession = await this.prisma.session.findFirst({
      where: { campId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    let nextSortOrder = lastSession ? lastSession.sortOrder + 1 : 0

    let imported = 0
    const errors: ImportSessionRowError[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const columnNum = i + 2 // column 1 = field keys, column 2 = first session
      const sessionName = row['name']?.trim() ?? ''

      try {
        // 1. Validate
        const validationError = validateSessionCsvRow(row, camp.type)
        if (validationError) throw new Error(validationError)

        // 2. Parse
        const parsed = parseSessionCsvRow(row)

        // 3. Check date overlap against existing sessions + batch
        const allExisting = [
          ...existingSessions.map(s => ({
            startDate: new Date(s.startDate),
            endDate: new Date(s.endDate),
          })),
          ...createdInBatch,
        ]

        for (const existing of allExisting) {
          const overlaps =
            parsed.startDate <= existing.endDate && parsed.endDate >= existing.startDate
          if (overlaps) {
            throw new Error(
              `Session dates (${row['startDate']} – ${row['endDate']}) overlap with another session in this camp`
            )
          }
        }

        // 4. Create
        await this.prisma.session.create({
          data: {
            campId,
            name: parsed.name,
            startDate: parsed.startDate,
            endDate: parsed.endDate,
            pricingType: parsed.pricingType,
            price: parsed.price ?? null,
            ageGroupPrices: parsed.ageGroupPrices ? (parsed.ageGroupPrices as any) : null,
            availabilityType: parsed.availabilityType,
            totalSpots: parsed.totalSpots ?? null,
            ageGroupSpots: parsed.ageGroupSpots ? (parsed.ageGroupSpots as any) : null,
            sessionDayType: parsed.sessionDayType ?? null,
            arrivalTime: parsed.arrivalTime ?? null,
            departureTime: parsed.departureTime ?? null,
            status: parsed.status,
            discounts: { globalApplied: [], globalRemoved: [], sessionSpecific: [] } as any,
            sortOrder: nextSortOrder,
          },
        })

        createdInBatch.push({ startDate: parsed.startDate, endDate: parsed.endDate })
        nextSortOrder++
        imported++
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error'
        errors.push({ column: columnNum, name: sessionName, reason })
      }
    }

    return { imported, failed: errors.length, errors }
  }
}
