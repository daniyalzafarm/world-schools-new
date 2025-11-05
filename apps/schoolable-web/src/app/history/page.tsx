'use client'

import { Button, Card, CardBody, Chip } from '@heroui/react'
import { Clock, Eye, MessageSquare, Trash2 } from 'lucide-react'

// Mock data for chat history
const chatHistory = [
  {
    id: '1',
    title: 'Math Lesson Plan for 5th Grade',
    preview: 'Created a comprehensive lesson plan covering fractions and decimals...',
    timestamp: '2 hours ago',
    category: 'Lesson Planning',
    messageCount: 12,
  },
  {
    id: '2',
    title: 'Science Quiz Questions',
    preview: 'Generated 20 multiple choice questions about the solar system...',
    timestamp: '1 day ago',
    category: 'Assessment',
    messageCount: 8,
  },
  {
    id: '3',
    title: 'Reading Comprehension Activities',
    preview: 'Discussed various strategies to improve student reading skills...',
    timestamp: '3 days ago',
    category: 'Activities',
    messageCount: 15,
  },
  {
    id: '4',
    title: 'Classroom Management Tips',
    preview: 'Explored effective techniques for managing a diverse classroom...',
    timestamp: '1 week ago',
    category: 'Management',
    messageCount: 6,
  },
  {
    id: '5',
    title: 'Art Project Ideas',
    preview: 'Brainstormed creative art projects for elementary students...',
    timestamp: '2 weeks ago',
    category: 'Creative',
    messageCount: 10,
  },
]

const categoryColors: Record<string, any> = {
  'Lesson Planning': 'primary',
  Assessment: 'secondary',
  Activities: 'success',
  Management: 'warning',
  Creative: 'danger',
}

export default function HistoryPage() {
  const handleViewChat = (_chatId: string) => {
    // TODO: Navigate to specific chat
    // console.warn('Viewing chat:', _chatId)
  }

  const handleDeleteChat = (_chatId: string) => {
    // TODO: Implement delete functionality
    // console.warn('Deleting chat:', _chatId)
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/50 rounded-lg flex items-center justify-center">
            <Clock size={20} className="text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Chat History</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View and manage your previous conversations
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {chatHistory.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12">
                <MessageSquare size={24} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No chat history yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Start a new conversation to see your chat history here.
                </p>
                <Button color="primary" onPress={() => (window.location.href = '/chat/new')}>
                  Start New Chat
                </Button>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              {chatHistory.map(chat => (
                <Card key={chat.id} className="hover:shadow-md transition-shadow duration-200">
                  <CardBody className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {chat.title}
                          </h3>
                          <Chip
                            size="sm"
                            color={categoryColors[chat.category] || 'default'}
                            variant="flat"
                          >
                            {chat.category}
                          </Chip>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                          {chat.preview}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <MessageSquare size={16} />
                            {chat.messageCount} messages
                          </span>
                          <span>{chat.timestamp}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          onPress={() => handleViewChat(chat.id)}
                          className="text-gray-500 hover:text-primary-600"
                        >
                          <Eye size={16} />
                        </Button>
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          onPress={() => handleDeleteChat(chat.id)}
                          className="text-gray-500 hover:text-danger-600"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
