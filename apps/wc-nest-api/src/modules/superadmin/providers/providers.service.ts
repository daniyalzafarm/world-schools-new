import * as crypto from 'crypto'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { parse } from 'csv-parse/sync'
import * as bcrypt from 'bcryptjs'
import { EmailService } from '@world-schools/global-utils'
import { PrismaService } from '../../../prisma/prisma.service'
import { RedisService } from '../../redis/redis.service'
import { ConfigService } from '../../../config/config.service'
import { EmailTemplateService } from '../../common/email-templates/email-template.service'
import { GoogleBusinessService } from '../../provider/onboarding/services/google-business.service'
import { ProviderLogoService } from '../../provider/onboarding/services/provider-logo.service'
import { CreateProviderDto } from './dto/create-provider.dto'
import { UpdateAppFeeDto } from './dto/update-app-fee.dto'
import { UpdateProviderDto } from './dto/update-provider.dto'
import { parseProviderCsvRow, validateProviderCsvRow } from './providers-csv.helpers'

export interface ImportRowError {
  column: number
  email: string
  reason: string
}

export interface ImportProvidersResult {
  imported: number
  failed: number
  errors: ImportRowError[]
}

@Injectable()
export class SuperAdminProvidersService {
  private readonly logger = new Logger(SuperAdminProvidersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailService: EmailService,
    private readonly googleBusinessService: GoogleBusinessService,
    private readonly providerLogoService: ProviderLogoService
  ) {}

  async create(createProviderDto: CreateProviderDto) {
    // Verify owner exists
    const owner = await this.prisma.user.findUnique({
      where: { id: createProviderDto.ownerId },
    })

    if (!owner) {
      throw new NotFoundException(`User with ID '${createProviderDto.ownerId}' not found`)
    }

    // Check if owner already has a provider
    const existingProvider = await this.prisma.provider.findUnique({
      where: { ownerId: createProviderDto.ownerId },
    })

    if (existingProvider) {
      throw new ConflictException(`User '${owner.email}' already owns a provider`)
    }

    // Create provider
    const provider = await this.prisma.provider.create({
      data: createProviderDto,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            roles: true,
          },
        },
      },
    })

    return provider
  }

  async findAll() {
    return this.prisma.provider.findMany({
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            roles: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  async findOne(id: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            roles: true,
          },
        },
      },
    })

    if (!provider) {
      throw new NotFoundException(`Provider with ID '${id}' not found`)
    }

    return provider
  }

  async update(id: string, updateProviderDto: UpdateProviderDto) {
    // Verify provider exists
    await this.findOne(id)

    // Update provider
    const provider = await this.prisma.provider.update({
      where: { id },
      data: updateProviderDto,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            roles: true,
          },
        },
      },
    })

    return provider
  }

  /**
   * Set the per-provider app-fee override.
   *
   * When `custom = true`, REQUIRES `appFeePercentage`. When false, the saved
   * percentage is preserved on the row (so toggling back on retains the
   * suggestion) but ignored at booking time. Audit fields are stamped on every
   * write so the UI can show "Last changed by".
   *
   * Existing bookings are NOT touched: `BookingGroup.appFeePercentageSnapshot`
   * is frozen at creation, so this only affects future bookings.
   */
  async setAppFee(providerId: string, dto: UpdateAppFeeDto, adminUserId: string) {
    if (dto.custom && (dto.appFeePercentage == null || Number.isNaN(dto.appFeePercentage))) {
      throw new BadRequestException('appFeePercentage is required when custom is true')
    }

    await this.findOne(providerId)

    const provider = await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        appFeeCustom: dto.custom,
        // Only overwrite the percentage when custom=true. Toggle-off keeps the
        // previous value as a default for the next toggle-on.
        ...(dto.custom && dto.appFeePercentage != null
          ? { appFeePercentage: dto.appFeePercentage }
          : {}),
        appFeeUpdatedAt: new Date(),
        appFeeUpdatedByAdminId: adminUserId,
      },
      include: {
        appFeeUpdatedByAdmin: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    })

    this.logger.log(
      `provider ${providerId} app-fee custom=${dto.custom} percentage=${
        dto.appFeePercentage ?? 'n/a'
      } by admin ${adminUserId}`
    )

    return provider
  }

  // Payments revamp (Spec v2.3): `setPayoutMode` is removed — the platform no
  // longer schedules payouts. Providers receive Stripe automatic payouts and
  // manage their own schedule in their Stripe dashboard.

  async getDetail(id: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        appFeeUpdatedByAdmin: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        settings: true,
        verificationDocuments: true,
        camps: {
          include: {
            _count: {
              select: {
                sessions: true,
                bookingGroups: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        bookingGroups: {
          take: 5,
          orderBy: { requestedAt: 'desc' },
          include: {
            parent: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            camp: {
              select: { name: true },
            },
            session: {
              select: { name: true, startDate: true, endDate: true },
            },
          },
        },
        _count: {
          select: {
            camps: true,
            bookingGroups: true,
          },
        },
      },
    })

    if (!provider) {
      throw new NotFoundException(`Provider with ID '${id}' not found`)
    }

    const [revenueResult, reviewResult] = await Promise.all([
      this.prisma.bookingGroup.aggregate({
        where: {
          providerId: id,
          status: { in: ['deposit_paid', 'fully_paid', 'at_camp', 'completed'] },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.campReview.aggregate({
        where: { camp: { providerId: id }, status: 'published' },
        _avg: { happinessRating: true },
        _count: { _all: true },
      }),
    ])

    const logoUrl = provider.logoUrl
      ? await this.providerLogoService.generateLogoUrl(provider.logoUrl)
      : null

    return {
      ...provider,
      logoUrl,
      stats: {
        activeCampsCount: provider.camps.filter(c => c.status === 'published').length,
        totalSessionsCount: provider.camps.reduce((acc, c) => acc + c._count.sessions, 0),
        totalBookingsCount: provider._count.bookingGroups,
        totalRevenue: revenueResult._sum.totalAmount ?? 0,
        averageRating: reviewResult._avg?.happinessRating ?? null,
        reviewsCount: reviewResult._count._all,
      },
    }
  }

  // `remove(id)` is intentionally removed. See the matching
  // comment on the deleted DELETE endpoint in the superadmin providers
  // controller. Providers cannot be deleted post-onboarding — their row is
  // the foreign-key spine for the entire billing audit trail (Payment,
  // Booking, Payout, Refund, Reimbursement, Dispute). Lifecycle is now
  // "active → suspended → archived"; archived state is what suspends
  // operations without destroying audit data.

  async generateImpersonationToken(
    providerId: string,
    superadmin: { id: string; email: string; firstName?: string; lastName?: string }
  ): Promise<{ token: string }> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        legalCompanyName: true,
        ownerId: true,
        owner: {
          select: { id: true, email: true },
        },
      },
    })

    if (!provider) {
      throw new NotFoundException(`Provider with ID '${providerId}' not found`)
    }

    if (!provider.ownerId) {
      throw new NotFoundException(`Provider '${providerId}' has no owner account`)
    }

    const token = crypto.randomUUID()
    const superadminName =
      [superadmin.firstName, superadmin.lastName].filter(Boolean).join(' ') || superadmin.email

    await this.redisService.set(
      `impersonate:${token}`,
      JSON.stringify({
        superadminId: superadmin.id,
        superadminEmail: superadmin.email,
        superadminName,
        providerOwnerId: provider.ownerId,
        providerId: provider.id,
      }),
      60 // 60 second TTL — single-use, tight window for redirect
    )

    return { token }
  }

  async importFromCsv(
    fileBuffer: Buffer,
    adminUser: { id: string; email: string; firstName?: string; lastName?: string }
  ): Promise<ImportProvidersResult> {
    // Parse CSV — column-oriented format: first column = field key, each subsequent column = one provider
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

    // Transpose: each raw row is [fieldKey, providerValue0, providerValue1, ...]
    const numProviders = rawRows.length > 0 ? rawRows[0].length - 1 : 0

    if (numProviders === 0) {
      return { imported: 0, failed: 0, errors: [] }
    }

    if (numProviders > 500) {
      throw new Error('CSV file exceeds the 500-provider limit. Please split into smaller files.')
    }

    const rows: Record<string, string>[] = Array.from({ length: numProviders }, (_, p) => {
      const record: Record<string, string> = {}
      for (const rawRow of rawRows) {
        const key = rawRow[0] ?? ''
        record[key] = rawRow[p + 1] ?? ''
      }
      return record
    })

    // Find the Provider Admin system role once
    const providerAdminRole = await this.prisma.role.findFirst({
      where: { name: 'Provider Admin', isSystemRole: true },
    })

    if (!providerAdminRole) {
      throw new Error(
        'Provider Admin role not found. Please ensure the system is seeded correctly.'
      )
    }

    const saltRounds = this.configService.jwtConfig.bcryptSaltRounds
    const loginUrl = `${this.configService.providerPortalUrl}/auth/login`

    let imported = 0
    const errors: ImportRowError[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // 1-indexed; column 1 = field keys, column 2 = first provider
      const email = row['email']?.trim() ?? ''

      try {
        // 1. Validate required fields and email format
        const validationError = validateProviderCsvRow(row)
        if (validationError) throw new Error(validationError)

        // 2. Check email uniqueness
        const existingUser = await this.prisma.user.findUnique({ where: { email } })
        if (existingUser) throw new Error(`Email already exists: ${email}`)

        const parsed = parseProviderCsvRow(row)
        const passwordHash = await bcrypt.hash(parsed.password, saltRounds)
        const now = new Date()

        // 3. Resolve GBP before the transaction — external HTTP call cannot run inside a Prisma tx
        let gbp: Awaited<ReturnType<typeof this.googleBusinessService.resolveGbp>> | null = null
        if (parsed.googlePlaceId) {
          gbp = await this.googleBusinessService.resolveGbp(parsed.googlePlaceId)

          const claimingProvider = await this.prisma.provider.findFirst({
            where: { gbpId: gbp.id },
            select: { id: true },
          })
          if (claimingProvider) {
            throw new Error('This Google Place ID is already registered with another provider')
          }
        }

        // 4. Single transaction: user + provider (with all fields) + role + settings
        await this.prisma.$transaction(async tx => {
          const user = await tx.user.create({
            data: {
              email: parsed.email,
              passwordHash,
              passwordChangedAt: now,
              firstName: parsed.firstName,
              lastName: parsed.lastName,
              emailVerified: true,
              emailVerifiedAt: now,
            },
          })
          await tx.userRole.create({
            data: { userId: user.id, roleId: providerAdminRole.id },
          })

          const provider = await tx.provider.create({
            data: {
              ownerId: user.id,
              approvalStatus: 'approved',
              approvedByAdminId: adminUser.id,
              approvalDecisionAt: now,
              applicationSubmittedAt: now,
              onboardingStartedAt: now,
              onboardingCompletedAt: now,
              onboardingCurrentStep: 7,
              contactFirstName: parsed.firstName,
              contactLastName: parsed.lastName,
              contactRole: parsed.jobTitle,
              contactPhone: parsed.phoneNumber,
              contactEmail: parsed.email,
              ...(parsed.description && { description: parsed.description }),
              ...(parsed.campTypes && { campType: parsed.campTypes }),
              ...(gbp
                ? {
                    gbpId: gbp.id,
                    legalCompanyName: parsed.legalCompanyName || gbp.businessName || '',
                    legalStreetAddress:
                      [gbp.streetNumber, gbp.streetName].filter(Boolean).join(' ') ||
                      gbp.formattedAddress ||
                      '',
                    legalCity: gbp.city ?? '',
                    legalStateProvince: gbp.state ?? '',
                    legalPostalCode: gbp.postalCode ?? '',
                    legalCountry: gbp.country ?? '',
                    yearFounded: parsed.yearFounded ?? 0,
                    phone: parsed.providerPhone,
                    email: parsed.providerEmail ?? parsed.email,
                    website: parsed.website,
                  }
                : {
                    ...(parsed.legalCompanyName && { legalCompanyName: parsed.legalCompanyName }),
                    ...(parsed.yearFounded && { yearFounded: parsed.yearFounded }),
                    ...(parsed.providerPhone && { phone: parsed.providerPhone }),
                    ...(parsed.providerEmail && { email: parsed.providerEmail }),
                    ...(parsed.website && { website: parsed.website }),
                  }),
            },
          })
          await tx.providerSettings.upsert({
            where: { providerId: provider.id },
            create: {
              providerId: provider.id,
              currency: parsed.currency,
              timezone: parsed.timezone,
              depositRequired: parsed.depositRequired ?? false,
              cancellationPolicy: parsed.cancellationPolicy ?? 'moderate',
              ...(parsed.depositType && { depositType: parsed.depositType }),
              ...(parsed.depositPercentage !== undefined && {
                depositPercentage: parsed.depositPercentage,
              }),
              ...(parsed.depositFixedAmount !== undefined && {
                depositFixedAmount: parsed.depositFixedAmount,
              }),
            },
            update: {
              currency: parsed.currency,
              timezone: parsed.timezone,
              ...(parsed.depositRequired !== undefined && {
                depositRequired: parsed.depositRequired,
              }),
              ...(parsed.cancellationPolicy && { cancellationPolicy: parsed.cancellationPolicy }),
              ...(parsed.depositType && { depositType: parsed.depositType }),
              ...(parsed.depositPercentage !== undefined && {
                depositPercentage: parsed.depositPercentage,
              }),
              ...(parsed.depositFixedAmount !== undefined && {
                depositFixedAmount: parsed.depositFixedAmount,
              }),
            },
          })
        })

        // 5. Send welcome email (fire-and-forget)
        this.sendWelcomeEmail({
          to: parsed.email,
          firstName: parsed.firstName,
          tempPassword: parsed.password,
          loginUrl,
        }).catch(err => {
          this.logger.warn(
            `Column ${rowNum}: Failed to send welcome email to ${parsed.email}: ${err}`
          )
        })

        imported++
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error'
        errors.push({ column: rowNum, email, reason })
      }
    }

    return { imported, failed: errors.length, errors }
  }

  private async sendWelcomeEmail(params: {
    to: string
    firstName: string
    tempPassword: string
    loginUrl: string
  }): Promise<void> {
    const html = this.emailTemplateService.getProviderImportWelcomeTemplate({
      firstName: params.firstName,
      email: params.to,
      tempPassword: params.tempPassword,
      loginUrl: params.loginUrl,
    })

    await this.emailService.sendEmail({
      to: params.to,
      subject: 'Welcome to World-Camps — Your Provider Account is Ready',
      html,
    })
  }
}
