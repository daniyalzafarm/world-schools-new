'use client'

import React, { useEffect } from 'react'
import { Card, CardBody } from '@heroui/react'
// Icon import removed - unused
import { getInitials } from '@world-schools/ui-web'
import MainLayout from '@/components/layout/main-layout'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useConversationStore } from '@/stores/conversation-store'
import { useAuthStore } from '@/stores/auth-store'
import { useRouter } from 'next/navigation'
import { adminConversationData } from '@/data/conversations'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { MessageCircle } from 'lucide-react'

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

// Chart data based on the screenshot
const chartData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  datasets: [
    {
      label: 'recommendations',
      data: [1.5, 2.0, 1.0, 1.2, 2.0, 0.8, 1.2, 2.2, 0.6, 1.5, 2.2, 1.0],
      backgroundColor: '#1E263B',
      borderColor: '#1E263B',
      borderWidth: 0,
    },
    {
      label: 'profile views',
      data: [0.8, 1.8, 0.8, 1.0, 1.8, 0.6, 0.8, 1.8, 0.2, 1.0, 1.8, 0.8],
      backgroundColor: '#6366F1',
      borderColor: '#6366F1',
      borderWidth: 0,
    },
    {
      label: 'chats initiated',
      data: [0.5, 1.6, 0.2, 0.8, 1.6, 0.2, 0.4, 1.6, 0.1, 0.6, 1.6, 0.4],
      backgroundColor: '#E0E7FF',
      borderColor: '#E0E7FF',
      borderWidth: 0,
    },
  ],
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        padding: 20,
        font: {
          size: 12,
        },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: 'white',
      bodyColor: 'white',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      cornerRadius: 8,
      displayColors: true,
      callbacks: {
        title: (context: any) => {
          const month = context[0].label
          const year = '2025'
          return `${month} ${year}`
        },
        label: (context: any) => {
          const label = context.dataset.label
          const value = context.parsed.y
          return `${label}: ${value}k`
        },
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        font: {
          size: 12,
        },
      },
    },
    y: {
      beginAtZero: true,
      max: 4,
      ticks: {
        stepSize: 1,
        callback: (value: any) => `${value}k`,
        font: {
          size: 12,
        },
      },
      grid: {
        color: 'rgba(0, 0, 0, 0.1)',
      },
    },
  },
  interaction: {
    intersect: false,
    mode: 'index' as const,
  },
}

export default function AdminDashboardPage() {
  const { user } = useAuthStore()
  const { adminConversations, setAdminConversations } = useConversationStore()
  const router = useRouter()

  // Initialize conversation data on component mount
  useEffect(() => {
    if (adminConversations.length === 0) {
      setAdminConversations(adminConversationData)
    }
  }, [adminConversations.length, setAdminConversations])

  // Get user's first name for welcome message
  const firstName = user?.firstName || 'Admin'

  // Get recent chats (limit to 4, filter out archived)
  const recentChats = adminConversations.filter(chat => !chat.archived).slice(0, 4)

  // Handle chat click
  const handleChatClick = (chatId: string) => {
    router.push(`/admin/messages/${chatId}`)
  }

  return (
    <ProtectedRoute requireAuth={true} requireAdmin={true}>
      <MainLayout>
        <div className="min-h-full bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Welcome Section */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Welcome back, {firstName}!
              </h1>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              <Card className="bg-white dark:bg-gray-800 shadow-sm">
                <CardBody className="p-6 text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    2.5k
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">recommendations</div>
                </CardBody>
              </Card>
              <Card className="bg-white dark:bg-gray-800 shadow-sm">
                <CardBody className="p-6 text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">1k</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">profile views</div>
                </CardBody>
              </Card>
              <Card className="bg-white dark:bg-gray-800 shadow-sm">
                <CardBody className="p-6 text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    0.5k
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">chats initiated</div>
                </CardBody>
              </Card>
            </div>

            {/* Chart Section */}
            <Card className="bg-white dark:bg-gray-800 shadow-sm mb-8">
              <CardBody className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                  Last 12 Months Statistics
                </h2>
                <div className="h-80">
                  <Bar data={chartData} options={chartOptions} />
                </div>
              </CardBody>
            </Card>

            {/* Recent Chats Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                Recent Chats
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {recentChats.map(chat => (
                  <Card
                    key={chat.id}
                    className="bg-white dark:bg-gray-800 shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200"
                    isPressable
                    onPress={() => handleChatClick(chat.id)}
                  >
                    <CardBody className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            {getInitials(chat.name)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {chat.name}
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Asks about:
                            {chat.lastMessage.includes('...') ? 'General Inquiry' : 'New Topic'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                            {chat.lastMessage}
                          </p>
                        </div>
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center shrink-0">
                          <MessageCircle className="w-4 h-4 text-gray-500" />
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}

                {/* Show placeholder cards if not enough conversations */}
                {recentChats.length < 4 &&
                  Array.from({ length: 4 - recentChats.length }).map((_, index) => (
                    <Card
                      key={`placeholder-${index}`}
                      className="bg-white dark:bg-gray-800 shadow-sm"
                    >
                      <CardBody className="p-4">
                        <div className="flex items-start space-x-3">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                              JD
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                              John D.
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                              Asks about: New Camp
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                              Lorem ipsum dolor sit...
                            </p>
                          </div>
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center shrink-0">
                            <MessageCircle className="w-4 h-4 text-gray-500" />
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    </ProtectedRoute>
  )
}
