import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { parse } from 'csv-parse/sync'
import { PrismaService } from '../../../prisma/prisma.service'
import { GoogleBusinessService } from '../../provider/onboarding/services/google-business.service'
import { generateCampSlug, parseCampCsvRow, validateCampCsvRow } from './camps-csv.helpers'

export interface ImportCampRowError {
  column: number
  name: string
  reason: string
}

export interface ImportCampsResult {
  imported: number
  failed: number
  errors: ImportCampRowError[]
}

@Injectable()
export class SuperAdminCampsService {
  private readonly logger = new Logger(SuperAdminCampsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleBusinessService: GoogleBusinessService
  ) {}

  async importFromCsv(fileBuffer: Buffer, providerId: string): Promise<ImportCampsResult> {
    // Verify provider exists and fetch its GBP data for 'provider' location type
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        gbpId: true,
        googleBusinessProfile: {
          select: {
            placeId: true,
            businessName: true,
            formattedAddress: true,
            lat: true,
            lng: true,
          },
        },
      },
    })

    if (!provider) {
      throw new NotFoundException(`Provider with ID '${providerId}' not found`)
    }

    // Parse CSV — column-oriented format: first column = field key, each subsequent column = one camp
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

    // Transpose: each raw row is [fieldKey, campValue0, campValue1, ...]
    const numCamps = rawRows.length > 0 ? rawRows[0].length - 1 : 0

    if (numCamps === 0) {
      return { imported: 0, failed: 0, errors: [] }
    }

    if (numCamps > 500) {
      throw new Error('CSV file exceeds the 500-camp limit. Please split into smaller files.')
    }

    const rows: Record<string, string>[] = Array.from({ length: numCamps }, (_, p) => {
      const record: Record<string, string> = {}
      for (const rawRow of rawRows) {
        const key = rawRow[0] ?? ''
        record[key] = rawRow[p + 1] ?? ''
      }
      return record
    })

    let imported = 0
    const errors: ImportCampRowError[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // column 1 = field keys, column 2 = first camp
      const campName = row['name']?.trim() ?? ''

      try {
        // 1. Validate required fields + value constraints
        const validationError = validateCampCsvRow(row)
        if (validationError) throw new Error(validationError)

        // 2. Parse the validated row
        const parsed = parseCampCsvRow(row)

        // 3. Resolve slug — generate if absent, ensure uniqueness
        let slug = parsed.slug ?? generateCampSlug(parsed.name)
        const existingSlug = await this.prisma.camp.findUnique({ where: { slug } })
        if (existingSlug) {
          // Try appending -2, -3, ... until unique
          let suffix = 2
          let candidate = `${slug}-${suffix}`
          while (await this.prisma.camp.findUnique({ where: { slug: candidate } })) {
            suffix++
            candidate = `${slug}-${suffix}`
          }
          slug = candidate
        }

        // 4. Resolve location + gbpId (external calls must happen outside Prisma transaction)
        let locationData: {
          locationType: 'provider' | 'different'
          locationPlaceId?: string
          locationName?: string
          locationAddress?: string
          locationLat?: number
          locationLng?: number
          gbpId?: string
        } = {
          locationType: parsed.locationType,
          locationPlaceId: parsed.locationPlaceId,
          locationName: parsed.locationName,
          locationAddress: parsed.locationAddress,
        }

        if (parsed.locationType === 'provider') {
          // Inherit location and GBP from the provider's registered profile
          const gbp = provider.googleBusinessProfile
          if (gbp) {
            locationData = {
              locationType: 'provider',
              locationPlaceId: gbp.placeId ?? undefined,
              locationName: gbp.businessName ?? undefined,
              locationAddress: gbp.formattedAddress ?? undefined,
              locationLat: gbp.lat !== null ? Number(gbp.lat) : undefined,
              locationLng: gbp.lng !== null ? Number(gbp.lng) : undefined,
              gbpId: provider.gbpId ?? undefined,
            }
          }
        } else if (parsed.locationType === 'different' && parsed.locationPlaceId) {
          // Resolve (or create) a GBP record for this venue
          const gbp = await this.googleBusinessService.findOrCreateGbp(parsed.locationPlaceId)
          if (gbp) {
            locationData.gbpId = gbp.id
          }
        }

        // 5. Create the camp as a draft
        await this.prisma.camp.create({
          data: {
            providerId,
            name: parsed.name,
            slug,
            type: parsed.type,
            description: parsed.description,
            gender: parsed.gender,
            ageGroups: parsed.ageGroups as any,
            languages: parsed.languages,
            activities: parsed.activities,
            status: 'draft',
            locationType: locationData.locationType,
            ...(locationData.locationPlaceId && {
              locationPlaceId: locationData.locationPlaceId,
            }),
            ...(locationData.locationName && { locationName: locationData.locationName }),
            ...(locationData.locationAddress && {
              locationAddress: locationData.locationAddress,
            }),
            ...(locationData.locationLat !== undefined && {
              locationLat: locationData.locationLat,
            }),
            ...(locationData.locationLng !== undefined && {
              locationLng: locationData.locationLng,
            }),
            ...(locationData.gbpId && { gbpId: locationData.gbpId }),
          },
        })

        imported++
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error'
        errors.push({ column: rowNum, name: campName, reason })
      }
    }

    return { imported, failed: errors.length, errors }
  }
}
