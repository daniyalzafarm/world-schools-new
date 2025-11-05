import type { ChatHistoryItem, Message } from '@/types/chat'

// Helper function to create timestamps
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000)
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000)
const weeksAgo = (weeks: number) => new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000)

// Helper function to format timestamp for display
const formatTimestamp = (date: Date): string => {
  const now = new Date()
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

  if (diffInHours < 1) return 'Just now'
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`

  return date.toLocaleDateString()
}

// Sample messages for different conversations
const createSampleMessages = (conversationType: string): Message[] => {
  switch (conversationType) {
    case 'math-lesson':
      return [
        {
          id: '1',
          text: 'I need help creating a math lesson plan for 5th grade students covering fractions and decimals.',
          isUser: true,
          timestamp: hoursAgo(2.5),
        },
        {
          id: '2',
          text: "I'd be happy to help you create a comprehensive math lesson plan for 5th grade fractions and decimals! Let me break this down into a structured lesson that will engage your students and build their understanding progressively.",
          isUser: false,
          timestamp: hoursAgo(2.4),
        },
        {
          id: '3',
          text: 'Can you include some hands-on activities and visual aids?',
          isUser: true,
          timestamp: hoursAgo(2.3),
        },
        {
          id: '4',
          text: 'Absolutely! Here are some engaging hands-on activities and visual aids for your fractions and decimals lesson...',
          isUser: false,
          timestamp: hoursAgo(2.2),
        },
      ]

    case 'science-quiz':
      return [
        {
          id: '1',
          text: 'Generate 20 multiple choice questions about the solar system for middle school students.',
          isUser: true,
          timestamp: daysAgo(1.2),
        },
        {
          id: '2',
          text: 'Here are 20 multiple choice questions about the solar system, designed for middle school students with varying difficulty levels...',
          isUser: false,
          timestamp: daysAgo(1.1),
        },
      ]

    case 'reading-comprehension':
      return [
        {
          id: '1',
          text: 'What are some effective strategies to improve student reading comprehension skills?',
          isUser: true,
          timestamp: daysAgo(3.1),
        },
        {
          id: '2',
          text: 'Here are several proven strategies to enhance reading comprehension skills in students...',
          isUser: false,
          timestamp: daysAgo(3.0),
        },
      ]

    default:
      return [
        {
          id: '1',
          text: 'Hello, I need some help with educational planning.',
          isUser: true,
          timestamp: new Date(),
        },
        {
          id: '2',
          text: "I'd be happy to help you with educational planning! What specific area would you like to focus on?",
          isUser: false,
          timestamp: new Date(),
        },
      ]
  }
}

// Mock chat history data
export const mockChatHistory: ChatHistoryItem[] = [
  {
    id: 'chat-1',
    title: 'Math Lesson Plan for 5th Grade',
    preview:
      'Created a comprehensive lesson plan covering fractions and decimals with hands-on activities...',
    timestamp: formatTimestamp(hoursAgo(2)),
    category: 'Lesson Planning',
    messageCount: 12,
    messages: createSampleMessages('math-lesson'),
    createdAt: hoursAgo(2.5),
    updatedAt: hoursAgo(2),
    isArchived: false,
    isFavorite: true,
    tags: ['math', 'fractions', 'decimals', '5th-grade'],
  },
  {
    id: 'chat-2',
    title: 'Science Quiz Questions',
    preview:
      'Generated 20 multiple choice questions about the solar system for middle school students...',
    timestamp: formatTimestamp(daysAgo(1)),
    category: 'Assessment',
    messageCount: 8,
    messages: createSampleMessages('science-quiz'),
    createdAt: daysAgo(1.2),
    updatedAt: daysAgo(1),
    isArchived: false,
    isFavorite: false,
    tags: ['science', 'solar-system', 'quiz', 'middle-school'],
  },
  {
    id: 'chat-3',
    title: 'Reading Comprehension Activities',
    preview:
      'Discussed various strategies to improve student reading skills and comprehension techniques...',
    timestamp: formatTimestamp(daysAgo(3)),
    category: 'Activities',
    messageCount: 15,
    messages: createSampleMessages('reading-comprehension'),
    createdAt: daysAgo(3.1),
    updatedAt: daysAgo(3),
    isArchived: false,
    isFavorite: false,
    tags: ['reading', 'comprehension', 'strategies'],
  },
  {
    id: 'chat-4',
    title: 'Long chat title will look like this when it gets really long and needs to be truncated',
    preview: 'This is a longer conversation about various educational topics and methodologies...',
    timestamp: formatTimestamp(daysAgo(5)),
    category: 'General',
    messageCount: 23,
    messages: createSampleMessages('general'),
    createdAt: daysAgo(5.2),
    updatedAt: daysAgo(5),
    isArchived: false,
    isFavorite: false,
    tags: ['general', 'education', 'methodology'],
  },
  {
    id: 'chat-5',
    title: 'IB Curriculum Planning',
    preview:
      'Explored International Baccalaureate curriculum structure and implementation strategies...',
    timestamp: formatTimestamp(weeksAgo(1)),
    category: 'Curriculum',
    messageCount: 18,
    messages: createSampleMessages('general'),
    createdAt: weeksAgo(1.1),
    updatedAt: weeksAgo(1),
    isArchived: false,
    isFavorite: true,
    tags: ['ib', 'curriculum', 'international'],
  },
  {
    id: 'chat-6',
    title: 'Student Assessment Methods',
    preview:
      'Discussed modern assessment techniques and evaluation strategies for different learning styles...',
    timestamp: formatTimestamp(weeksAgo(2)),
    category: 'Assessment',
    messageCount: 14,
    messages: createSampleMessages('general'),
    createdAt: weeksAgo(2.1),
    updatedAt: weeksAgo(2),
    isArchived: false,
    isFavorite: false,
    tags: ['assessment', 'evaluation', 'learning-styles'],
  },
  {
    id: 'chat-7',
    title: 'Classroom Management Tips',
    preview:
      'Shared effective classroom management strategies for maintaining a positive learning environment...',
    timestamp: formatTimestamp(weeksAgo(3)),
    category: 'Management',
    messageCount: 9,
    messages: createSampleMessages('general'),
    createdAt: weeksAgo(3.1),
    updatedAt: weeksAgo(3),
    isArchived: false,
    isFavorite: false,
    tags: ['classroom', 'management', 'environment'],
  },
  {
    id: 'chat-8',
    title: 'Technology Integration in Education',
    preview:
      'Explored ways to effectively integrate technology tools into traditional teaching methods...',
    timestamp: formatTimestamp(weeksAgo(4)),
    category: 'Technology',
    messageCount: 21,
    messages: createSampleMessages('general'),
    createdAt: weeksAgo(4.1),
    updatedAt: weeksAgo(4),
    isArchived: true,
    isFavorite: false,
    tags: ['technology', 'integration', 'digital-tools'],
  },
  {
    id: 'chat-9',
    title: 'Creative Writing Prompts',
    preview:
      'Developed engaging creative writing prompts for elementary students to spark imagination...',
    timestamp: formatTimestamp(daysAgo(2)),
    category: 'Language Arts',
    messageCount: 11,
    messages: createSampleMessages('general'),
    createdAt: daysAgo(2.3),
    updatedAt: daysAgo(2),
    isArchived: false,
    isFavorite: false,
    tags: ['writing', 'creative', 'elementary', 'prompts'],
  },
  {
    id: 'chat-10',
    title: 'History Timeline Activities',
    preview:
      'Created interactive timeline activities for teaching world history to high school students...',
    timestamp: formatTimestamp(daysAgo(4)),
    category: 'History',
    messageCount: 16,
    messages: createSampleMessages('general'),
    createdAt: daysAgo(4.2),
    updatedAt: daysAgo(4),
    isArchived: false,
    isFavorite: true,
    tags: ['history', 'timeline', 'interactive', 'high-school'],
  },
  {
    id: 'chat-11',
    title: 'Art Project Ideas',
    preview:
      'Brainstormed seasonal art projects that incorporate STEAM principles for middle school...',
    timestamp: formatTimestamp(daysAgo(6)),
    category: 'Arts',
    messageCount: 13,
    messages: createSampleMessages('general'),
    createdAt: daysAgo(6.1),
    updatedAt: daysAgo(6),
    isArchived: false,
    isFavorite: false,
    tags: ['art', 'steam', 'projects', 'seasonal'],
  },
  {
    id: 'chat-12',
    title: 'Physical Education Games',
    preview: 'Designed inclusive PE games that accommodate different skill levels and abilities...',
    timestamp: formatTimestamp(weeksAgo(1.5)),
    category: 'Physical Education',
    messageCount: 7,
    messages: createSampleMessages('general'),
    createdAt: weeksAgo(1.6),
    updatedAt: weeksAgo(1.5),
    isArchived: false,
    isFavorite: false,
    tags: ['pe', 'games', 'inclusive', 'fitness'],
  },
  {
    id: 'chat-13',
    title: 'Music Theory for Beginners',
    preview: 'Explained basic music theory concepts and how to teach them to young students...',
    timestamp: formatTimestamp(weeksAgo(2.5)),
    category: 'Music',
    messageCount: 19,
    messages: createSampleMessages('general'),
    createdAt: weeksAgo(2.6),
    updatedAt: weeksAgo(2.5),
    isArchived: false,
    isFavorite: false,
    tags: ['music', 'theory', 'beginners', 'teaching'],
  },
  {
    id: 'chat-14',
    title: 'Environmental Science Projects',
    preview: 'Developed hands-on environmental science projects for Earth Day celebrations...',
    timestamp: formatTimestamp(weeksAgo(3.5)),
    category: 'Science',
    messageCount: 12,
    messages: createSampleMessages('general'),
    createdAt: weeksAgo(3.6),
    updatedAt: weeksAgo(3.5),
    isArchived: false,
    isFavorite: true,
    tags: ['environment', 'science', 'earth-day', 'projects'],
  },
  {
    id: 'chat-15',
    title: 'Foreign Language Teaching Methods',
    preview: 'Discussed effective methods for teaching Spanish to English-speaking students...',
    timestamp: formatTimestamp(weeksAgo(5)),
    category: 'Language',
    messageCount: 17,
    messages: createSampleMessages('general'),
    createdAt: weeksAgo(5.1),
    updatedAt: weeksAgo(5),
    isArchived: false,
    isFavorite: false,
    tags: ['spanish', 'foreign-language', 'teaching-methods'],
  },
]

// Helper functions for working with chat history
export const getChatHistoryById = (id: string): ChatHistoryItem | undefined => {
  return mockChatHistory.find(item => item.id === id)
}

export const getRecentChatHistory = (limit = 4): ChatHistoryItem[] => {
  return mockChatHistory
    .filter(item => !item.isArchived)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit)
}

export const searchChatHistory = (query: string): ChatHistoryItem[] => {
  if (!query.trim()) return mockChatHistory.filter(item => !item.isArchived)

  const lowercaseQuery = query.toLowerCase()
  return mockChatHistory
    .filter(item => !item.isArchived)
    .filter(
      item =>
        item.title.toLowerCase().includes(lowercaseQuery) ||
        item.preview.toLowerCase().includes(lowercaseQuery) ||
        item.category.toLowerCase().includes(lowercaseQuery) ||
        item.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    )
}

export const getFavoriteChatHistory = (): ChatHistoryItem[] => {
  return mockChatHistory.filter(item => item.isFavorite && !item.isArchived)
}

export const getChatHistoryByCategory = (category: string): ChatHistoryItem[] => {
  return mockChatHistory.filter(
    item => item.category.toLowerCase() === category.toLowerCase() && !item.isArchived
  )
}

// Helper function to group chat history by time periods
export const getGroupedChatHistory = (limit = 10): { [key: string]: ChatHistoryItem[] } => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thisMonth = new Date(today.getFullYear(), now.getMonth(), 1)
  const lastMonth = new Date(today.getFullYear(), now.getMonth() - 1, 1)

  const recentHistory = mockChatHistory
    .filter(item => !item.isArchived)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit)

  const grouped: { [key: string]: ChatHistoryItem[] } = {
    Today: [],
    Yesterday: [],
    'This week': [],
    'This month': [],
    'Last month': [],
    Older: [],
  }

  recentHistory.forEach(item => {
    const itemDate = item.updatedAt

    if (itemDate >= today) {
      grouped['Today'].push(item)
    } else if (itemDate >= yesterday) {
      grouped['Yesterday'].push(item)
    } else if (itemDate >= thisWeek) {
      grouped['This week'].push(item)
    } else if (itemDate >= thisMonth) {
      grouped['This month'].push(item)
    } else if (itemDate >= lastMonth) {
      grouped['Last month'].push(item)
    } else {
      grouped['Older'].push(item)
    }
  })

  // Remove empty groups
  Object.keys(grouped).forEach(key => {
    if (grouped[key].length === 0) {
      delete grouped[key]
    }
  })

  return grouped
}
