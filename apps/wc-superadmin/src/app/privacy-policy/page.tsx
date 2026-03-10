'use client'

import React from 'react'
import { Button } from '@heroui/react'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/layout/logo'
import { useRouter } from 'next/navigation'

export default function PrivacyPolicyPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Header with Logo */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <Logo size="lg" showText={true} />
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto px-6 py-8 w-full">
        <div className="prose prose-lg max-w-none">
          <div className="flex items-center justify-between gap-4 mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">Privacy Policy</h1>
            <Button
              variant="light"
              size="sm"
              onPress={() => router.back()}
              startContent={<ArrowLeft size={18} />}
              className="text-gray-600 dark:text-gray-400"
            >
              Back
            </Button>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              1. Introduction
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              Welcome to the World Camps Superadmin Portal. We are committed to protecting your
              personal information and your right to privacy. This Privacy Policy explains how we
              collect, use, disclose, and safeguard your information when you use this portal to
              manage providers, applications, and platform settings.
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              By using the Superadmin Portal, you agree to the collection and use of information in
              accordance with this policy. If you do not agree with our policies and practices,
              please do not use this portal.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              2. Information We Collect
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 leading-relaxed mb-4 space-y-2">
              <li>
                <strong>Account Information:</strong> Name, email address, password, role, and
                contact details
              </li>
              <li>
                <strong>Activity Information:</strong> Actions taken in the Superadmin Portal (for
                example, approvals, configuration changes, and user management)
              </li>
              <li>
                <strong>Communication Data:</strong> Messages and support interactions related to
                platform administration
              </li>
              <li>
                <strong>Usage Data:</strong> Information about how you use the portal, including
                pages viewed and features accessed
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              3. How We Use Your Information
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 leading-relaxed mb-4 space-y-2">
              <li>Provide, maintain, and improve the Superadmin Portal</li>
              <li>Authenticate and manage superadmin accounts and permissions</li>
              <li>Audit and track administrative actions for security and compliance</li>
              <li>Communicate with you about platform status, incidents, and updates</li>
              <li>Support investigations into security, abuse, or policy violations</li>
              <li>Comply with legal, regulatory, and contractual obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              4. Data Sharing and Disclosure
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We may share your information with:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 leading-relaxed mb-4 space-y-2">
              <li>
                <strong>Internal Teams:</strong> World Camps staff who require access to administer
                the platform
              </li>
              <li>
                <strong>Service Providers:</strong> Third-party vendors that help operate and secure
                the platform
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law or in response to valid
                legal requests
              </li>
              <li>
                <strong>Business Transfers:</strong> In connection with any merger, sale of company
                assets, or acquisition
              </li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We do not sell your personal information to third parties for their own marketing
              purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              5. Data Security
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We implement appropriate technical and organizational security measures to protect
              your personal information against unauthorized access, alteration, disclosure, or
              destruction. However, no method of transmission over the internet or electronic
              storage is 100% secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              6. Your Rights
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              Depending on your location, you may have rights under applicable data protection laws,
              including the right to access, correct, or delete your personal information, and to
              object to or restrict certain processing.
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              To exercise these rights, please contact us using the details provided below.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              7. Cookies and Tracking Technologies
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We use cookies and similar tracking technologies to understand how the Superadmin
              Portal is used, improve performance, and keep your session secure. You can control
              cookies through your browser settings, but disabling them may affect functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              8. Changes to This Privacy Policy
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We may update this Privacy Policy from time to time. We will post the updated policy
              on this page and update the &quot;Last updated&quot; date at the top. We encourage you
              to review this page periodically for any changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              9. Contact Us
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              If you have any questions about this Privacy Policy or our data practices for the
              Superadmin Portal, please contact us at:
            </p>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Email:</strong> privacy@worldcamps.com
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
