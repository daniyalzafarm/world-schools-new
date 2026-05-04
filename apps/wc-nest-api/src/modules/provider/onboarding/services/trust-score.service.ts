import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'

@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate trust score for a provider
   * Score is 0-100 based on provider-controlled factors (no admin approval dependencies)
   *
   * Breakdown:
   * - Step 1 (Google Business): 30 pts
   * - Step 2 (Legal Info + Business Age): 30 pts
   * - Step 3 (Camp Profile): 10 pts
   * - Step 4 (Document Verification): 20 pts
   * - Step 5 (Payment & Policies): 10 pts
   * Total: 100 pts
   */
  async calculateTrustScore(providerId: string): Promise<{ score: number; breakdown: any }> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        googleBusinessProfile: true,
        settings: true,
        verificationDocuments: true,
      },
    })

    if (!provider) {
      return { score: 0, breakdown: {} }
    }

    let score = 0
    const breakdown: any = {}

    // 1. Google Business Profile (30 points)
    if (provider.googleBusinessProfile) {
      const gbp = provider.googleBusinessProfile
      let gbpScore = 0

      // Has Google Business Profile: +10 points
      gbpScore += 10
      breakdown.hasGoogleBusiness = 10

      // Google rating (0-5 stars): up to 15 points
      if (gbp.rating) {
        const rating = typeof gbp.rating === 'number' ? gbp.rating : Number(gbp.rating)
        const ratingScore = Math.round((rating / 5) * 15)
        gbpScore += ratingScore
        breakdown.googleRating = ratingScore
      }

      // Number of reviews: up to 5 points
      if (gbp.reviewsCount) {
        const reviewScore = Math.min(5, Math.floor(gbp.reviewsCount / 10))
        gbpScore += reviewScore
        breakdown.googleReviews = reviewScore
      }

      score += gbpScore
    }

    // 2. Business Age (15 points)
    if (provider.yearFounded) {
      const currentYear = new Date().getFullYear()
      const yearsInBusiness = currentYear - provider.yearFounded

      if (yearsInBusiness >= 10) {
        score += 15
        breakdown.businessAge = 15
      } else if (yearsInBusiness >= 5) {
        score += 10
        breakdown.businessAge = 10
      } else if (yearsInBusiness >= 2) {
        score += 5
        breakdown.businessAge = 5
      }
    }

    // 3. Legal Information Completeness (15 points)
    if (provider.legalCompanyName && provider.legalStreetAddress && provider.legalCity) {
      score += 15
      breakdown.legalInfoComplete = 15
    }

    // 4. Camp Profile Completeness (10 points) - Step 3
    let campProfileScore = 0

    // Description quality: 4 points
    if (provider.description) {
      const descLength = provider.description.length
      if (descLength >= 100 && descLength <= 300) {
        campProfileScore += 4
        breakdown.descriptionComplete = 4
      }
    }

    // Camp type selected: 6 points (increased from 2 to compensate for removed age range)
    if (provider.campType) {
      campProfileScore += 6
      breakdown.campTypeSelected = 6
    }

    // Note: Age range scoring removed as minAge/maxAge fields were removed from Provider model
    // Age ranges are now defined per camp/session instead of at provider level

    score += campProfileScore

    // 5. Document Verification (20 points base + up to 30 bonus) - Step 4
    let documentScore = 0

    // Required Documents (20 points)
    // Business registration: 10 points
    const businessReg = provider.verificationDocuments.find(
      d => d.documentType === 'business_registration'
    )
    if (businessReg) {
      documentScore += 10
      breakdown.businessRegistration = 10
    }

    // Insurance certificate: 10 points
    const insurance = provider.verificationDocuments.find(
      d => d.documentType === 'insurance_certificate'
    )
    if (insurance) {
      documentScore += 10
      breakdown.insuranceCertificate = 10
    }

    // Optional Accreditations (up to 15 bonus points)
    let accreditationScore = 0
    const accreditationTypes = [
      'aca',
      'icf',
      'bsa',
      'national_accreditation',
      'regional_accreditation',
      'other_accreditation',
    ]
    const accreditations = provider.verificationDocuments.filter(d =>
      accreditationTypes.includes(d.documentType)
    )

    // ACA or ICF: 5 points each (premium accreditations)
    const hasACA = accreditations.some(d => d.documentType === 'aca')
    const hasICF = accreditations.some(d => d.documentType === 'icf')
    if (hasACA) {
      accreditationScore += 5
      breakdown.acaAccreditation = 5
    }
    if (hasICF) {
      accreditationScore += 5
      breakdown.icfAccreditation = 5
    }

    // Other accreditations: 2 points each (max 10 points total for all other accreditations)
    const otherAccreditations = accreditations.filter(d => !['aca', 'icf'].includes(d.documentType))
    const otherAccreditationPoints = Math.min(10, otherAccreditations.length * 2)
    if (otherAccreditationPoints > 0) {
      accreditationScore += otherAccreditationPoints
      breakdown.otherAccreditations = otherAccreditationPoints
    }

    // Cap accreditation score at 15 points
    accreditationScore = Math.min(15, accreditationScore)
    documentScore += accreditationScore

    // Optional Safety Certifications (up to 15 bonus points)
    let safetyScore = 0
    const safetyTypes = [
      'risk_policy',
      'first_aid',
      'lifeguard',
      'background_check',
      'emergency_plan',
      'food_safety',
      'other_safety',
    ]
    const safetyCerts = provider.verificationDocuments.filter(d =>
      safetyTypes.includes(d.documentType)
    )

    // Each safety certification: 2.5 points (max 15 points for 6 certifications)
    const safetyPoints = Math.min(15, safetyCerts.length * 2.5)
    if (safetyPoints > 0) {
      safetyScore += safetyPoints
      breakdown.safetyCertifications = safetyPoints
    }

    documentScore += safetyScore

    score += documentScore

    // 6. Payment & Policies Configuration (10 points) - Step 5
    let policiesScore = 0

    if (provider.settings) {
      const settings = provider.settings

      // Deposit configured: 5 points
      if (settings.depositRequired && settings.depositType) {
        if (settings.depositType === 'percentage' && settings.depositPercentage) {
          policiesScore += 5
          breakdown.depositConfigured = 5
        } else if (settings.depositType === 'fixed' && settings.depositFixedAmount) {
          policiesScore += 5
          breakdown.depositConfigured = 5
        }
      }

      // Cancellation policy: up to 5 points
      // Flexible policy (most customer-friendly) = 5 pts
      // Moderate policy = 3 pts
      // Custom = 0 pts (provider-defined; not awarded)
      if (settings.cancellationPolicy) {
        let policyScore = 0
        if (settings.cancellationPolicy === 'flexible') {
          policyScore = 5
        } else if (settings.cancellationPolicy === 'moderate') {
          policyScore = 3
        }
        policiesScore += policyScore
        breakdown.cancellationPolicy = policyScore
      }
    }

    score += policiesScore

    // Ensure score is between 0 and 100
    score = Math.min(100, Math.max(0, score))

    return { score, breakdown }
  }

  /**
   * Update provider's trust score
   */
  async updateTrustScore(providerId: string): Promise<void> {
    const { score, breakdown } = await this.calculateTrustScore(providerId)

    await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        trustScore: score,
        trustScoreBreakdown: breakdown,
      },
    })

    this.logger.log(`Updated trust score for provider ${providerId}: ${score}`)
  }

  /**
   * Get recommended action based on trust score
   */
  getRecommendedAction(score: number): 'auto_approve' | 'manual_review' | 'reject' {
    if (score >= 80) {
      return 'auto_approve'
    } else if (score >= 50) {
      return 'manual_review'
    } else {
      return 'reject'
    }
  }

  /**
   * Get trust score label
   */
  getTrustScoreLabel(score: number): string {
    if (score >= 80) {
      return 'Excellent'
    } else if (score >= 60) {
      return 'Good'
    } else if (score >= 40) {
      return 'Fair'
    } else {
      return 'Needs Review'
    }
  }
}
