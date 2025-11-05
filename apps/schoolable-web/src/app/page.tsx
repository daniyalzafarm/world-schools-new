'use client'

import MainLayout from '@/components/layout/main-layout'
import { Button, Card, CardBody, CardHeader } from '@heroui/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/hooks/use-admin'

export default function Home() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { isAdmin } = useAdmin()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect admin to dashboard when page loads
  useEffect(() => {
    if (mounted && isAdmin) {
      router.push('/admin/dashboard')
    }
  }, [mounted, isAdmin, router])

  if (!mounted) return null

  // Don't render the home page content for admins (they'll be redirected)
  if (isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Redirecting to admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <MainLayout>
      <div className="min-h-full bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold text-primary mb-4">Schoolable Web</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              AI-powered educational platform built with Next.js, HeroUI, and industry best
              practices
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-2">
                <h3 className="text-xl font-semibold">🤖 AI-Powered Learning</h3>
              </CardHeader>
              <CardBody>
                <p className="text-gray-600 dark:text-gray-300">
                  Intelligent tutoring system that adapts to individual learning styles and provides
                  personalized educational content.
                </p>
              </CardBody>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-2">
                <h3 className="text-xl font-semibold">📚 Lesson Planning</h3>
              </CardHeader>
              <CardBody>
                <p className="text-gray-600 dark:text-gray-300">
                  Create comprehensive lesson plans with AI assistance, including objectives,
                  activities, and assessments.
                </p>
              </CardBody>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-2">
                <h3 className="text-xl font-semibold">📊 Smart Assessments</h3>
              </CardHeader>
              <CardBody>
                <p className="text-gray-600 dark:text-gray-300">
                  Generate quizzes, tests, and assignments automatically based on curriculum
                  standards and learning objectives.
                </p>
              </CardBody>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-2">
                <h3 className="text-xl font-semibold">🎯 Personalized Learning</h3>
              </CardHeader>
              <CardBody>
                <p className="text-gray-600 dark:text-gray-300">
                  Adaptive learning paths that adjust difficulty and content based on student
                  progress and performance.
                </p>
              </CardBody>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-2">
                <h3 className="text-xl font-semibold">🌐 Global Community</h3>
              </CardHeader>
              <CardBody>
                <p className="text-gray-600 dark:text-gray-300">
                  Connect with educators worldwide through WorldSchools and WorldCamps platforms.
                </p>
              </CardBody>
            </Card>

            <Card className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-2">
                <h3 className="text-xl font-semibold">🌙 Modern Interface</h3>
              </CardHeader>
              <CardBody>
                <p className="text-gray-600 dark:text-gray-300">
                  Beautiful, accessible interface with built-in dark mode support and responsive
                  design.
                </p>
              </CardBody>
            </Card>
          </div>

          <div className="text-center">
            <div className="flex gap-4 justify-center items-center mb-8">
              <Button
                color="primary"
                size="lg"
                className="font-semibold"
                onPress={() => router.push('/chat/new')}
              >
                Start Learning
              </Button>
              <Button
                variant="bordered"
                size="lg"
                onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                Toggle {theme === 'dark' ? 'Light' : 'Dark'} Mode
              </Button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ready to transform education with AI
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
