import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../../prisma/prisma.service'

@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate trust score for a provider
   * Score is 0-100 based on multiple factors
   */
  async calculateTrustScore(providerId: string): Promise<{ score: number; breakdown: any }> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        googleBusinessProfile: true,
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

    // 2. Verification Documents (40 points)
    const documents = provider.verificationDocuments || []
    let docScore = 0

    // Business registration: 20 points
    const businessReg = documents.find(d => d.documentType === 'business_registration')
    if (businessReg) {
      if (businessReg.reviewStatus === 'approved') {
        docScore += 20
        breakdown.businessRegistration = 20
      } else if (businessReg.reviewStatus === 'pending') {
        docScore += 10
        breakdown.businessRegistration = 10
      }
    }

    // Insurance certificate: 20 points
    const insurance = documents.find(d => d.documentType === 'insurance_certificate')
    if (insurance) {
      if (insurance.reviewStatus === 'approved') {
        docScore += 20
        breakdown.insuranceCertificate = 20
      } else if (insurance.reviewStatus === 'pending') {
        docScore += 10
        breakdown.insuranceCertificate = 10
      }
    }

    score += docScore

    // 3. Business Age (15 points)
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

    // 4. Contact Information Completeness (15 points)
    let contactScore = 0

    if (provider.contactPhone && provider.phoneVerified) {
      contactScore += 5
      breakdown.phoneVerified = 5
    }

    if (provider.legalCompanyName && provider.legalStreetAddress && provider.legalCity) {
      contactScore += 10
      breakdown.legalInfoComplete = 10
    }

    score += contactScore

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
