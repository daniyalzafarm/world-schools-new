export interface UserProfile {
  id: string
  firstName: string
  lastName: string
  avatar?: string
  bio?: string
  location?: string
  languages: string[]
  joinDate: Date
  isVerified: boolean
  overallRating: number
  totalReviews: number
}

export interface Review {
  id: string
  reviewerId: string
  reviewerName: string
  reviewerAvatar?: string
  rating: number
  comment: string
  date: Date
  location?: string
}

export interface UserProfileData {
  profile: UserProfile
  children: Array<{
    id: string
    name: string
    personalInfo: {
      firstName: string
      dateOfBirth: Date
      gender: string
      nationality: string
      languages: string[]
    }
    academicPreferences: {
      currentGrade: string
      favoriteSubjects: string[]
      learningStyle: string
      languagesOfInstruction: string[]
      interestedInBoarding: string
    }
    extraCurricular: {
      interests: string[]
      preferredSchedule: string
    }
    specialNeeds: {
      areas: string[]
      supportNeeds: string[]
      additionalNotes: string
    }
  }>
  reviews: Review[]
}
