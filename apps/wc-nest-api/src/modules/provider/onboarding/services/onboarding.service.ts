import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'
import { SaveContactInfoDto } from '../dto/contact-info.dto'
import { SaveCampInfoDto } from '../dto/camp-info.dto'
import { OnboardingStatusDto } from '../dto/onboarding-status.dto'
import { TrustScoreService } from './trust-score.service'
import {
  CURRENT_PROVIDER_AGREEMENT_VERSION,
  CURRENT_TERMS_VERSION,
} from '../constants/terms-versions'
import { ApplicationNotificationService } from '../../../common/email-templates/application-notification.service'

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly trustScoreService: TrustScoreService,
    private readonly applicationNotificationService: ApplicationNotificationService
  ) {}

  /**
   * Get onboarding status for a provider
   */
  async getOnboardingStatus(providerId: string): Promise<OnboardingStatusDto> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        googleBusinessProfile: true,
        settings: true,
        verificationDocuments: true,
      },
    })

    if (!provider) {
      throw new NotFoundException('Provider not found')
    }

    // Determine step completion
    const stepCompletion = {
      step1: !!provider.googleBusinessProfile,
      step2: !!(
        provider.contactFirstName &&
        provider.contactLastName &&
        provider.contactRole &&
        provider.contactPhone &&
        provider.contactEmail &&
        provider.name &&
        provider.legalCompanyName &&
        provider.legalStreetAddress &&
        provider.legalCity &&
        provider.legalStateProvince &&
        provider.legalPostalCode &&
        provider.legalCountry &&
        provider.yearFounded
      ),
      step3: !!(provider.description && provider.campType && provider.minAge && provider.maxAge),
      step4: provider.verificationDocuments.length > 0,
      step5: !!provider.settings,
      step6: !!provider.onboardingCompletedAt, // Step 6 is completed when onboarding is submitted
    }

    return {
      currentStep: provider.onboardingCurrentStep,
      isCompleted: !!provider.onboardingCompletedAt,
      onboardingStartedAt: provider.onboardingStartedAt?.toISOString(),
      onboardingCompletedAt: provider.onboardingCompletedAt?.toISOString() || null,
      approvalStatus: provider.approvalStatus,
      trustScore: provider.trustScore,
      trustScoreBreakdown: provider.trustScoreBreakdown as Record<string, number> | null,
      rejectionReason: provider.rejectionReason,
      rejectionCategory: provider.rejectionCategory,
      stepCompletion,
      termsAcceptedAt: provider.termsAcceptedAt?.toISOString() || null,
      termsVersion: provider.termsVersion || null,
      providerAgreementAcceptedAt: provider.providerAgreementAcceptedAt?.toISOString() || null,
      providerAgreementVersion: provider.providerAgreementVersion || null,
    }
  }

  /**
   * Start onboarding for a provider
   */
  async startOnboarding(providerId: string): Promise<void> {
    await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        onboardingStartedAt: new Date(),
        onboardingCurrentStep: 1,
      },
    })

    this.logger.log(`Started onboarding for provider ${providerId}`)
  }

  /**
   * Get contact and legal information (Step 2)
   */
  async getContactInfo(providerId: string): Promise<SaveContactInfoDto | null> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        contactFirstName: true,
        contactLastName: true,
        contactRole: true,
        contactPhone: true,
        contactEmail: true,
        name: true,
        phone: true,
        email: true,
        website: true,
        legalCompanyName: true,
        legalStreetAddress: true,
        legalAptSuite: true,
        legalCity: true,
        legalStateProvince: true,
        legalPostalCode: true,
        legalCountry: true,
        yearFounded: true,
      },
    })

    if (!provider) {
      return null
    }

    // Return null if no contact info has been saved yet
    if (!provider.contactFirstName) {
      return null
    }

    return {
      contactFirstName: provider.contactFirstName,
      contactLastName: provider.contactLastName,
      contactRole: provider.contactRole,
      contactPhone: provider.contactPhone,
      contactEmail: provider.contactEmail,
      providerName: provider.name,
      providerPhone: provider.phone,
      providerEmail: provider.email,
      website: provider.website,
      legalCompanyName: provider.legalCompanyName,
      legalStreetAddress: provider.legalStreetAddress,
      legalAptSuite: provider.legalAptSuite,
      legalCity: provider.legalCity,
      legalStateProvince: provider.legalStateProvince,
      legalPostalCode: provider.legalPostalCode,
      legalCountry: provider.legalCountry,
      yearFounded: provider.yearFounded,
    } as SaveContactInfoDto
  }

  /**
   * Save contact and legal information (Step 2)
   */
  async saveContactInfo(providerId: string, dto: SaveContactInfoDto): Promise<void> {
    await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        contactFirstName: dto.contactFirstName,
        contactLastName: dto.contactLastName,
        contactRole: dto.contactRole,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        name: dto.providerName,
        phone: dto.providerPhone,
        email: dto.providerEmail,
        website: dto.website,
        legalCompanyName: dto.legalCompanyName,
        legalStreetAddress: dto.legalStreetAddress,
        legalAptSuite: dto.legalAptSuite,
        legalCity: dto.legalCity,
        legalStateProvince: dto.legalStateProvince,
        legalPostalCode: dto.legalPostalCode,
        legalCountry: dto.legalCountry,
        yearFounded: dto.yearFounded,
        onboardingCurrentStep: Math.max(3, (await this.getCurrentStep(providerId)) || 3),
      },
    })

    // Update trust score
    await this.trustScoreService.updateTrustScore(providerId)

    this.logger.log(`Saved contact info for provider ${providerId}`)
  }

  /**
   * Get camp information (Step 3)
   */
  async getCampInfo(providerId: string): Promise<SaveCampInfoDto | null> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: {
        description: true,
        campType: true,
        minAge: true,
        maxAge: true,
      },
    })

    if (!provider) {
      return null
    }

    // Return null if no camp info has been saved yet
    if (!provider.description) {
      return null
    }

    return {
      description: provider.description,
      campTypes: provider.campType ? provider.campType.split(',') : [],
      minAge: provider.minAge ?? 0,
      maxAge: provider.maxAge ?? 0,
    }
  }

  /**
   * Save camp information (Step 3)
   */
  async saveCampInfo(providerId: string, dto: SaveCampInfoDto): Promise<void> {
    await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        description: dto.description,
        campType: dto.campTypes.join(','), // Store as comma-separated string
        minAge: dto.minAge,
        maxAge: dto.maxAge,
        onboardingCurrentStep: Math.max(3, (await this.getCurrentStep(providerId)) || 3),
      },
    })

    // Update trust score
    await this.trustScoreService.updateTrustScore(providerId)

    this.logger.log(`Saved camp info for provider ${providerId}`)
  }

  /**
   * Validate Step 4 documents
   */
  async validateStep4Documents(providerId: string): Promise<void> {
    const documents = await this.prisma.verificationDocument.findMany({
      where: { providerId },
      select: { documentType: true, fileUrl: true },
    })

    const hasBusinessRegistration = documents.some(
      doc => doc.documentType === 'business_registration' && doc.fileUrl
    )
    const hasInsuranceCertificate = documents.some(
      doc => doc.documentType === 'insurance_certificate' && doc.fileUrl
    )

    const missingDocuments: string[] = []

    if (!hasBusinessRegistration) {
      missingDocuments.push('Business Registration')
    }

    if (!hasInsuranceCertificate) {
      missingDocuments.push('Insurance Certificate')
    }

    if (missingDocuments.length > 0) {
      throw new BadRequestException(
        `Cannot proceed to Step 5. Missing required documents: ${missingDocuments.join(', ')}`
      )
    }
  }

  /**
   * Validate onboarding completion
   */
  async validateOnboardingCompletion(providerId: string): Promise<{
    isValid: boolean
    errors: Array<{
      step: number
      stepName: string
      field: string
      message: string
      path: string
    }>
  }> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        googleBusinessProfile: true,
        settings: true,
        verificationDocuments: true,
      },
    })

    if (!provider) {
      throw new NotFoundException('Provider not found')
    }

    const errors: Array<{
      step: number
      stepName: string
      field: string
      message: string
      path: string
    }> = []

    // Step 1: Google Business Profile
    if (!provider.googleBusinessProfile) {
      errors.push({
        step: 1,
        stepName: 'Find Your Camp',
        field: 'googleBusinessProfile',
        message: 'Google Business Profile must be selected and saved',
        path: '/onboarding/step-1',
      })
    }

    // Step 2: Contact & Account Info
    if (
      !provider.contactFirstName ||
      !provider.contactLastName ||
      !provider.contactRole ||
      !provider.contactPhone ||
      !provider.legalCompanyName ||
      !provider.legalStreetAddress ||
      !provider.legalCity ||
      !provider.legalStateProvince ||
      !provider.legalPostalCode ||
      !provider.legalCountry ||
      !provider.yearFounded
    ) {
      errors.push({
        step: 2,
        stepName: 'Contact & Account',
        field: 'contactInfo',
        message: 'All required contact information and legal company details must be completed',
        path: '/onboarding/step-2',
      })
    }

    // Step 3: Camp Info
    if (!provider.description || !provider.campType || !provider.minAge || !provider.maxAge) {
      errors.push({
        step: 3,
        stepName: 'About Your Camp',
        field: 'campInfo',
        message: 'Camp description, type, and age range must be filled',
        path: '/onboarding/step-3',
      })
    }

    // Step 4: Required Documents
    const hasBusinessRegistration = provider.verificationDocuments.some(
      doc => doc.documentType === 'business_registration'
    )
    const hasInsuranceCertificate = provider.verificationDocuments.some(
      doc => doc.documentType === 'insurance_certificate'
    )

    if (!hasBusinessRegistration) {
      errors.push({
        step: 4,
        stepName: 'Verification Documents',
        field: 'business_registration',
        message: 'Business Registration document is required',
        path: '/onboarding/step-4',
      })
    }

    if (!hasInsuranceCertificate) {
      errors.push({
        step: 4,
        stepName: 'Verification Documents',
        field: 'insurance_certificate',
        message: 'Insurance Certificate document is required',
        path: '/onboarding/step-4',
      })
    }

    // Step 5: Payment & Policies
    if (!provider.settings) {
      errors.push({
        step: 5,
        stepName: 'Payment & Policies',
        field: 'settings',
        message: 'Payment settings and cancellation policy must be configured',
        path: '/onboarding/step-5',
      })
    } else {
      // Validate deposit settings
      if (provider.settings.depositRequired) {
        if (!provider.settings.depositType) {
          errors.push({
            step: 5,
            stepName: 'Payment & Policies',
            field: 'depositType',
            message: 'Deposit type must be selected',
            path: '/onboarding/step-5',
          })
        } else if (
          provider.settings.depositType === 'percentage' &&
          (!provider.settings.depositPercentage ||
            provider.settings.depositPercentage < 1 ||
            provider.settings.depositPercentage > 100)
        ) {
          errors.push({
            step: 5,
            stepName: 'Payment & Policies',
            field: 'depositPercentage',
            message: 'Deposit percentage must be between 1 and 100',
            path: '/onboarding/step-5',
          })
        } else if (
          provider.settings.depositType === 'fixed_amount' &&
          (!provider.settings.depositFixedAmount ||
            Number(provider.settings.depositFixedAmount) < 1)
        ) {
          errors.push({
            step: 5,
            stepName: 'Payment & Policies',
            field: 'depositFixedAmount',
            message: 'Deposit amount must be at least $1',
            path: '/onboarding/step-5',
          })
        }
      }

      // Validate cancellation policy
      if (!provider.settings.cancellationPolicy) {
        errors.push({
          step: 5,
          stepName: 'Payment & Policies',
          field: 'cancellationPolicy',
          message: 'Cancellation policy must be selected',
          path: '/onboarding/step-5',
        })
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Complete onboarding (after Step 6)
   */
  async completeOnboarding(providerId: string): Promise<void> {
    // Check if application has already been submitted
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { onboardingCompletedAt: true },
    })

    if (!provider) {
      throw new BadRequestException('Provider not found')
    }

    if (provider.onboardingCompletedAt) {
      throw new BadRequestException(
        'Application has already been submitted. You cannot submit the same application multiple times.'
      )
    }

    // Run comprehensive validation
    const validation = await this.validateOnboardingCompletion(providerId)

    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Onboarding validation failed',
        errors: validation.errors,
      })
    }

    const now = new Date()

    // Mark onboarding as completed with terms acceptance tracking
    await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        onboardingCompletedAt: now,
        onboardingCurrentStep: 6,
        approvalStatus: 'under_review',
        applicationSubmittedAt: now,

        // Capture terms acceptance timestamp and version
        termsAcceptedAt: now,
        termsVersion: CURRENT_TERMS_VERSION,
        providerAgreementAcceptedAt: now,
        providerAgreementVersion: CURRENT_PROVIDER_AGREEMENT_VERSION,
      },
    })

    // Update trust score
    await this.trustScoreService.updateTrustScore(providerId)

    this.logger.log(
      `Completed onboarding for provider ${providerId} - Terms v${CURRENT_TERMS_VERSION} and Provider Agreement v${CURRENT_PROVIDER_AGREEMENT_VERSION} accepted at ${now.toISOString()}`
    )

    // Send application submitted confirmation email
    await this.applicationNotificationService.sendApplicationSubmittedEmail(providerId)
  }

  /**
   * Update current step
   */
  async updateCurrentStep(providerId: string, step: number): Promise<void> {
    await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        onboardingCurrentStep: step,
      },
    })
  }

  /**
   * Get current step
   */
  private async getCurrentStep(providerId: string): Promise<number> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { onboardingCurrentStep: true },
    })

    return provider?.onboardingCurrentStep ?? 1
  }
}
