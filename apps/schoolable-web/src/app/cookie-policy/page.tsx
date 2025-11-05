'use client'

import React from 'react'
import { Button } from '@heroui/react'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/layout/logo'
import { useRouter } from 'next/navigation'

export default function CookiePolicyPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header with Logo */}
      <div className="p-6 border-b border-gray-200">
        <Logo size="lg" showText={true} />
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto px-6 py-8">
        <div className="prose prose-lg max-w-none">
          <div className="flex items-center justify-between gap-4 mb-8">
            <h1 className="text-4xl font-bold">Cookie Policy</h1>
            <Button
              variant="light"
              size="sm"
              onPress={() => router.back()}
              startContent={<ArrowLeft size={18} />}
              className="text-gray-600"
            >
              Back
            </Button>
          </div>

          <div className="text-sm text-gray-500 mb-8">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. What Are Cookies</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Cookies are small text files that are placed on your device when you visit our
              website. They help us provide you with a better experience by remembering your
              preferences, analyzing how you use our site, and personalizing content.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Types of Cookies We Use
            </h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Essential Cookies</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                These cookies are necessary for the website to function properly. They enable basic
                functions like page navigation, access to secure areas, and form submissions. The
                website cannot function properly without these cookies.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Performance Cookies</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                These cookies collect information about how visitors use our website, such as which
                pages are visited most often and if users get error messages. This helps us improve
                the performance of our website.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Functional Cookies</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                These cookies allow the website to remember choices you make and provide enhanced,
                more personal features. They may be set by us or by third-party providers whose
                services we have added to our pages.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Analytics Cookies</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                These cookies help us understand how visitors interact with our website by
                collecting and reporting information anonymously. This helps us improve our services
                and user experience.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. Specific Cookies We Use
            </h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-semibold text-gray-900">Cookie Name</th>
                    <th className="text-left py-2 font-semibold text-gray-900">Purpose</th>
                    <th className="text-left py-2 font-semibold text-gray-900">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 text-gray-700">session_id</td>
                    <td className="py-2 text-gray-700">Maintains your session</td>
                    <td className="py-2 text-gray-700">Session</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 text-gray-700">user_preferences</td>
                    <td className="py-2 text-gray-700">Stores your preferences</td>
                    <td className="py-2 text-gray-700">1 year</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 text-gray-700">analytics_id</td>
                    <td className="py-2 text-gray-700">Tracks usage analytics</td>
                    <td className="py-2 text-gray-700">2 years</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-700">marketing_consent</td>
                    <td className="py-2 text-gray-700">Stores marketing preferences</td>
                    <td className="py-2 text-gray-700">1 year</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Third-Party Cookies</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may use third-party services that place cookies on your device. These services
              include:
            </p>
            <ul className="list-disc pl-6 text-gray-700 leading-relaxed mb-4">
              <li>Google Analytics for website analytics</li>
              <li>Google Ads for advertising purposes</li>
              <li>Social media platforms for sharing features</li>
              <li>Payment processors for secure transactions</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mb-4">
              These third-party services have their own privacy policies and cookie practices. We
              encourage you to review their policies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              5. Managing Your Cookie Preferences
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You can control and manage cookies in several ways:
            </p>
            <ul className="list-disc pl-6 text-gray-700 leading-relaxed mb-4">
              <li>
                <strong>Browser Settings:</strong> Most browsers allow you to refuse cookies or
                delete them
              </li>
              <li>
                <strong>Cookie Consent:</strong> Use our cookie consent banner to manage preferences
              </li>
              <li>
                <strong>Third-Party Opt-outs:</strong> Visit third-party websites to opt out of
                their cookies
              </li>
              <li>
                <strong>Account Settings:</strong> Manage preferences through your Schoolable
                account
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              6. Impact of Disabling Cookies
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you choose to disable cookies, some features of our website may not function
              properly. This may affect:
            </p>
            <ul className="list-disc pl-6 text-gray-700 leading-relaxed mb-4">
              <li>Your ability to stay logged in</li>
              <li>Personalized recommendations</li>
              <li>Saved preferences and settings</li>
              <li>Analytics and performance monitoring</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Updates to This Policy</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may update this Cookie Policy from time to time to reflect changes in our practices
              or for other operational, legal, or regulatory reasons. We will notify you of any
              material changes by posting the updated policy on this page.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Contact Us</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions about our use of cookies or this Cookie Policy, please
              contact us at:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700">
                <strong>Email:</strong> privacy@schoolable.com
                <br />
                <strong>Address:</strong> 123 Education Street, Learning City, LC 12345
                <br />
                <strong>Subject:</strong> Cookie Policy Inquiry
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
