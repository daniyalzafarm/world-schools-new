import type { Conversation } from '@/types/conversation'
import type { UserProfileData } from '@/types/user-profile'

export const conversationData: Conversation[] = [
  {
    id: '1',
    name: 'Riverside Elementary School',
    lastMessage: 'How can we help you?..',
    time: Date.now() - 1000 * 60 * 5, // 5 minutes ago
    lastSeen: Date.now() - 1000 * 60 * 2, // 2 minutes ago
    avatar: 'school-1',
    starred: true,
    verified: true,
    unread: true,
    unreadCount: 3,
    pinned: true,
    pinnedAt: Date.now() - 1000 * 60 * 30, // Pinned 30 minutes ago
    muted: true,
  },
  {
    id: '2',
    name: 'Oakwood High School',
    lastMessage: 'How can we help you?..',
    time: Date.now() - 1000 * 60 * 15, // 15 minutes ago
    lastSeen: Date.now() - 1000 * 60 * 10, // 10 minutes ago
    avatar: 'school-2',
    unread: true,
    unreadCount: 0, // Marked as unread but no new messages
  },
  {
    id: '3',
    name: 'Sunset Valley Middle School',
    lastMessage: 'How can we help you?..',
    time: Date.now() - 1000 * 60 * 30, // 30 minutes ago
    lastSeen: Date.now() - 1000 * 60 * 25, // 25 minutes ago
    avatar: 'school-3',
    starred: true,
  },
  {
    id: '4',
    name: 'Adventure Summer Camp',
    lastMessage: 'How can we help you?..',
    time: Date.now() - 1000 * 60 * 60, // 1 hour ago
    lastSeen: Date.now() - 1000 * 60 * 45, // 45 minutes ago
    avatar: 'school-2',
    verified: true,
    muted: true,
    unread: true,
    unreadCount: 12, // High unread count
  },
  {
    id: '5',
    name: 'Creative Arts Camp',
    lastMessage: 'How can we help you?..',
    time: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60, // 1 hour ago
    avatar: 'school-1',
    starred: true,
    verified: true,
  },
  {
    id: '6',
    name: 'Mountain View Academy',
    lastMessage: 'How can we help you?..',
    time: Date.now() - 1000 * 60 * 60 * 3, // 3 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    avatar: 'school-3',
    verified: true,
  },
  {
    id: '7',
    name: 'Tech Innovation High',
    lastMessage: 'How can we help you?..',
    time: Date.now() - 1000 * 60 * 60 * 6, // 6 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 4, // 4 hours ago
    avatar: 'school-2',
    verified: true,
    pinned: true,
    pinnedAt: Date.now() - 1000 * 60 * 60, // Pinned 1 hour ago
  },
  {
    id: '8',
    name: 'Nature Discovery Camp',
    lastMessage: 'How can we help you?..',
    time: Date.now() - 1000 * 60 * 60 * 12, // 12 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 8, // 8 hours ago
    avatar: 'school-1',
    muted: true,
  },
  {
    id: '9',
    name: 'Sports Excellence Academy',
    lastMessage: 'How can we help you?..',
    time: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 20, // 20 hours ago
    avatar: 'school-3',
    starred: true,
    unread: true,
    unreadCount: 5,
  },
  // Archived conversations
  {
    id: 'archived-1',
    name: 'Old School Academy',
    lastMessage: 'Thanks for the great conversation!',
    time: Date.now() - 1000 * 60 * 60 * 24 * 14, // 2 weeks ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 24 * 13, // 13 days ago
    avatar: 'school-1',
    archived: true,
  },
  {
    id: 'archived-2',
    name: 'Previous Learning Center',
    lastMessage: 'Good luck with everything!',
    time: Date.now() - 1000 * 60 * 60 * 24 * 30, // 1 month ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 24 * 28, // 28 days ago
    avatar: 'school-2',
    archived: true,
    starred: true,
  },
]

// Admin-specific conversation data (user-initiated conversations)
export const adminConversationData: Conversation[] = [
  {
    id: 'admin-1',
    name: 'John Smith',
    lastMessage: 'Hi, I need help finding a good school for my daughter...',
    time: Date.now() - 1000 * 60 * 2, // 2 minutes ago
    lastSeen: Date.now() - 1000 * 30, // 30 seconds ago
    avatar: 'school-1',
    unread: true,
    unreadCount: 2,
    userProfileData: {
      profile: {
        id: 'user-admin-1',
        firstName: 'John',
        lastName: 'Smith',
        avatar: '/assets/avatar.png',
        bio: 'Parent looking for a great school fit for my daughter. Interested in international curricula and strong STEM programs.',
        location: 'Austin, TX',
        languages: ['English'],
        joinDate: new Date('2023-06-10'),
        isVerified: true,
        overallRating: 4.6,
        totalReviews: 1,
      },
      children: [
        {
          id: 'c-admin-1-1',
          name: 'Emily Smith',
          personalInfo: {
            firstName: 'Emily',
            dateOfBirth: new Date('2014-05-20'),
            gender: 'Female',
            nationality: 'American',
            languages: ['English'],
          },
          academicPreferences: {
            currentGrade: 'Middle School',
            favoriteSubjects: ['Mathematics', 'Science'],
            learningStyle: 'Visual',
            languagesOfInstruction: ['English'],
            interestedInBoarding: 'No',
          },
          extraCurricular: {
            interests: ['Robotics', 'Soccer'],
            preferredSchedule: 'After school',
          },
          specialNeeds: {
            areas: [],
            supportNeeds: [],
            additionalNotes: '',
          },
        },
      ],
      reviews: [
        {
          id: 'r-admin-1-1',
          reviewerId: 'school-xyz',
          reviewerName: 'Riverside Elementary',
          reviewerAvatar: '/assets/school-1.jpg',
          rating: 5,
          comment: 'Great communication and timely responses. Pleasure to assist.',
          date: new Date('2024-02-01'),
          location: 'Austin, TX',
        },
      ],
    } as UserProfileData,
  },
  {
    id: 'admin-2',
    name: 'Sarah Johnson',
    lastMessage: 'Can you recommend summer camps in the area?',
    time: Date.now() - 1000 * 60 * 15, // 15 minutes ago
    lastSeen: Date.now() - 1000 * 60 * 12, // 12 minutes ago
    avatar: 'child-2',
    unread: true,
    unreadCount: 1,
    userProfileData: {
      profile: {
        id: 'user-admin-2',
        firstName: 'Sarah',
        lastName: 'Johnson',
        avatar: '/assets/avatar.png',
        bio: 'Parent of two. We love exploring new educational opportunities and finding the perfect fit for our kids.',
        location: 'Los Angeles, CA',
        languages: ['English', 'Spanish'],
        joinDate: new Date('2022-03-15'),
        isVerified: true,
        overallRating: 4.8,
        totalReviews: 2,
      },
      children: [
        {
          id: 'c-admin-2-1',
          name: 'John Doe',
          personalInfo: {
            firstName: 'John',
            dateOfBirth: new Date('2015-06-26'),
            gender: 'Male',
            nationality: 'American',
            languages: ['English', 'Spanish'],
          },
          academicPreferences: {
            currentGrade: 'Primary',
            favoriteSubjects: ['Science', 'Information Technology', 'Artificial Intelligence'],
            learningStyle: 'Visual',
            languagesOfInstruction: ['English'],
            interestedInBoarding: 'No',
          },
          extraCurricular: {
            interests: ['Soccer', 'Art'],
            preferredSchedule: 'After school',
          },
          specialNeeds: {
            areas: [],
            supportNeeds: [],
            additionalNotes: '',
          },
        },
        {
          id: 'c-admin-2-2',
          name: 'Leila Doe',
          personalInfo: {
            firstName: 'Leila',
            dateOfBirth: new Date('2012-03-15'),
            gender: 'Female',
            nationality: 'American',
            languages: ['English'],
          },
          academicPreferences: {
            currentGrade: 'Middle School',
            favoriteSubjects: ['Art', 'Music'],
            learningStyle: 'Auditory',
            languagesOfInstruction: ['English'],
            interestedInBoarding: 'Yes',
          },
          extraCurricular: {
            interests: ['Music', 'Dance'],
            preferredSchedule: 'Weekend',
          },
          specialNeeds: {
            areas: [],
            supportNeeds: [],
            additionalNotes: '',
          },
        },
      ],
      reviews: [
        {
          id: 'r-admin-2-1',
          reviewerId: 'camp-abc',
          reviewerName: 'Adventure Summer Camp',
          reviewerAvatar: '/assets/school-2.jpg',
          rating: 5,
          comment: 'Very engaged parent, provided clear requirements for camp preferences.',
          date: new Date('2024-01-15'),
          location: 'Los Angeles, CA',
        },
        {
          id: 'r-admin-2-2',
          reviewerId: 'school-123',
          reviewerName: 'Sunset Valley Middle School',
          reviewerAvatar: '/assets/school-3.jpg',
          rating: 4,
          comment: 'Responsive and easy to work with.',
          date: new Date('2023-11-22'),
          location: 'Los Angeles, CA',
        },
      ],
    } as UserProfileData,
  },
  {
    id: 'admin-3',
    name: 'Mike Davis',
    lastMessage: 'Thank you for the information about the schools.',
    time: Date.now() - 1000 * 60 * 60, // 1 hour ago
    lastSeen: Date.now() - 1000 * 60 * 45, // 45 minutes ago
    avatar: 'school-3',
    unread: false,
    userProfileData: {
      profile: {
        id: 'user-admin-3',
        firstName: 'Mike',
        lastName: 'Davis',
        avatar: '/assets/avatar.png',
        bio: 'Researching high schools with strong athletics and AP programs.',
        location: 'Denver, CO',
        languages: ['English'],
        joinDate: new Date('2024-02-20'),
        isVerified: false,
        overallRating: 4.2,
        totalReviews: 1,
      },
      children: [
        {
          id: 'c-admin-3-1',
          name: 'Noah Davis',
          personalInfo: {
            firstName: 'Noah',
            dateOfBirth: new Date('2010-09-12'),
            gender: 'Male',
            nationality: 'American',
            languages: ['English'],
          },
          academicPreferences: {
            currentGrade: 'High School',
            favoriteSubjects: ['History', 'PE'],
            learningStyle: 'Kinesthetic',
            languagesOfInstruction: ['English'],
            interestedInBoarding: 'No',
          },
          extraCurricular: {
            interests: ['Basketball', 'Track'],
            preferredSchedule: 'After school',
          },
          specialNeeds: {
            areas: [],
            supportNeeds: [],
            additionalNotes: '',
          },
        },
      ],
      reviews: [
        {
          id: 'r-admin-3-1',
          reviewerId: 'school-789',
          reviewerName: 'Mountain View Academy',
          reviewerAvatar: '/assets/school-3.jpg',
          rating: 4,
          comment: 'Clear about requirements; quick decisions.',
          date: new Date('2024-03-10'),
          location: 'Denver, CO',
        },
      ],
    } as UserProfileData,
  },
  {
    id: 'admin-4',
    name: 'Emily Wilson',
    lastMessage: 'Is there a waiting list for the camp program?',
    time: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60, // 1 hour ago
    avatar: 'school-1',
    unread: false,
    userProfileData: {
      profile: {
        id: 'user-admin-4',
        firstName: 'Emily',
        lastName: 'Wilson',
        avatar: '/assets/avatar.png',
        bio: 'Looking for summer camps focused on arts and creativity.',
        location: 'Portland, OR',
        languages: ['English'],
        joinDate: new Date('2023-11-05'),
        isVerified: true,
        overallRating: 4.9,
        totalReviews: 0,
      },
      children: [
        {
          id: 'c-admin-4-1',
          name: 'Sophie Wilson',
          personalInfo: {
            firstName: 'Sophie',
            dateOfBirth: new Date('2013-02-02'),
            gender: 'Female',
            nationality: 'American',
            languages: ['English'],
          },
          academicPreferences: {
            currentGrade: 'Middle School',
            favoriteSubjects: ['Art', 'Literature'],
            learningStyle: 'Auditory',
            languagesOfInstruction: ['English'],
            interestedInBoarding: 'No',
          },
          extraCurricular: {
            interests: ['Painting', 'Choir'],
            preferredSchedule: 'Weekend',
          },
          specialNeeds: {
            areas: [],
            supportNeeds: [],
            additionalNotes: '',
          },
        },
      ],
      reviews: [],
    } as UserProfileData,
  },
  {
    id: 'admin-5',
    name: 'David Brown',
    lastMessage: 'What are the admission requirements?',
    time: Date.now() - 1000 * 60 * 60 * 3, // 3 hours ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    avatar: 'school-2',
    unread: false,
    userProfileData: {
      profile: {
        id: 'user-admin-5',
        firstName: 'David',
        lastName: 'Brown',
        avatar: '/assets/avatar.png',
        bio: 'Comparing admission processes for selective schools.',
        location: 'Chicago, IL',
        languages: ['English'],
        joinDate: new Date('2022-09-18'),
        isVerified: false,
        overallRating: 4.0,
        totalReviews: 1,
      },
      children: [],
      reviews: [
        {
          id: 'r-admin-5-1',
          reviewerId: 'school-456',
          reviewerName: 'Tech Innovation High',
          reviewerAvatar: '/assets/school-2.jpg',
          rating: 4,
          comment: 'Asked precise questions; smooth conversation.',
          date: new Date('2023-08-21'),
          location: 'Chicago, IL',
        },
      ],
    } as UserProfileData,
  },
  {
    id: 'admin-6',
    name: 'Lisa Garcia',
    lastMessage: 'Do you have any scholarships available?',
    time: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 20, // 20 hours ago
    avatar: 'child-1',
    unread: false,
    userProfileData: {
      profile: {
        id: 'user-admin-6',
        firstName: 'Lisa',
        lastName: 'Garcia',
        avatar: '/assets/avatar.png',
        bio: 'Exploring scholarship options and financial aid.',
        location: 'Miami, FL',
        languages: ['English', 'Spanish'],
        joinDate: new Date('2021-01-10'),
        isVerified: true,
        overallRating: 4.7,
        totalReviews: 1,
      },
      children: [
        {
          id: 'c-admin-6-1',
          name: 'Mateo Garcia',
          personalInfo: {
            firstName: 'Mateo',
            dateOfBirth: new Date('2016-07-30'),
            gender: 'Male',
            nationality: 'American',
            languages: ['English', 'Spanish'],
          },
          academicPreferences: {
            currentGrade: 'Primary',
            favoriteSubjects: ['Math', 'Science'],
            learningStyle: 'Visual',
            languagesOfInstruction: ['English', 'Spanish'],
            interestedInBoarding: 'No',
          },
          extraCurricular: {
            interests: ['Soccer', 'Coding'],
            preferredSchedule: 'After school',
          },
          specialNeeds: {
            areas: [],
            supportNeeds: [],
            additionalNotes: '',
          },
        },
      ],
      reviews: [
        {
          id: 'r-admin-6-1',
          reviewerId: 'camp-555',
          reviewerName: 'Nature Discovery Camp',
          reviewerAvatar: '/assets/school-1.jpg',
          rating: 5,
          comment: 'Very thorough and appreciative. Wonderful to assist.',
          date: new Date('2024-04-02'),
          location: 'Miami, FL',
        },
      ],
    } as UserProfileData,
  },
  // Admin archived conversations
  {
    id: 'admin-archived-1',
    name: 'Maria Rodriguez',
    lastMessage: 'Thank you for helping me find the right school for my son.',
    time: Date.now() - 1000 * 60 * 60 * 24 * 7, // 1 week ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 24 * 6, // 6 days ago
    avatar: 'school-1',
    archived: true,
    userProfileData: {
      profile: {
        id: 'user-admin-a1',
        firstName: 'Maria',
        lastName: 'Rodriguez',
        avatar: '/assets/avatar.png',
        bio: 'Completed the admission process for my son.',
        location: 'San Diego, CA',
        languages: ['English', 'Spanish'],
        joinDate: new Date('2020-05-12'),
        isVerified: true,
        overallRating: 4.5,
        totalReviews: 0,
      },
      children: [],
      reviews: [],
    } as UserProfileData,
  },
  {
    id: 'admin-archived-2',
    name: 'James Wilson',
    lastMessage: 'The camp information was very helpful.',
    time: Date.now() - 1000 * 60 * 60 * 24 * 14, // 2 weeks ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 24 * 12, // 12 days ago
    avatar: 'school-2',
    archived: true,
    starred: true,
    userProfileData: {
      profile: {
        id: 'user-admin-a2',
        firstName: 'James',
        lastName: 'Wilson',
        avatar: '/assets/avatar.png',
        bio: 'Wrapped up our camp search. Thanks!',
        location: 'Seattle, WA',
        languages: ['English'],
        joinDate: new Date('2023-03-03'),
        isVerified: false,
        overallRating: 4.1,
        totalReviews: 0,
      },
      children: [],
      reviews: [],
    } as UserProfileData,
  },
  {
    id: 'admin-archived-3',
    name: 'Jennifer Lee',
    lastMessage: 'I appreciate all the guidance you provided.',
    time: Date.now() - 1000 * 60 * 60 * 24 * 21, // 3 weeks ago
    lastSeen: Date.now() - 1000 * 60 * 60 * 24 * 18, // 18 days ago
    avatar: 'school-3',
    archived: true,
    userProfileData: {
      profile: {
        id: 'user-admin-a3',
        firstName: 'Jennifer',
        lastName: 'Lee',
        avatar: '/assets/avatar.png',
        bio: 'Completed our school applications successfully.',
        location: 'New York, NY',
        languages: ['English', 'Korean'],
        joinDate: new Date('2022-12-12'),
        isVerified: true,
        overallRating: 4.3,
        totalReviews: 0,
      },
      children: [],
      reviews: [],
    } as UserProfileData,
  },
]
