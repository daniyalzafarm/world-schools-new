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
        <Logo showText={true} />
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
              Welcome to World Camps. We are committed to protecting your personal information and
              your right to privacy. This Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you use our platform to discover and book camp
              experiences for your children.
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              By using World Camps, you agree to the collection and use of information in accordance
              with this policy. If you do not agree with our policies and practices, please do not
              use our services.
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
                <strong>Personal Information:</strong> Name, email address, phone number, postal
                address, and date of birth
              </li>
              <li>
                <strong>Child Information:</strong> Names, ages, dates of birth, medical
                information, dietary restrictions, and emergency contact details
              </li>
              <li>
                <strong>Payment Information:</strong> Credit card details, billing address, and
                transaction history
              </li>
              <li>
                <strong>Account Information:</strong> Username, password, profile photo, and
                preferences
              </li>
              <li>
                <strong>Communication Data:</strong> Messages sent through our platform, reviews,
                and feedback
              </li>
              <li>
                <strong>Usage Data:</strong> Information about how you use our services, including
                search queries, bookings, and browsing behavior
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
              <li>Provide, maintain, and improve our services</li>
              <li>Process bookings and payments</li>
              <li>Communicate with you about your bookings, account, and our services</li>
              <li>Send you marketing communications (with your consent)</li>
              <li>Personalize your experience and provide recommendations</li>
              <li>Facilitate communication between parents and camp providers</li>
              <li>Ensure the safety and security of our platform</li>
              <li>Comply with legal obligations and enforce our terms</li>
              <li>Analyze usage patterns to enhance our platform</li>
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
                <strong>Camp Providers:</strong> When you make a booking, we share necessary
                information with the camp provider to facilitate your reservation
              </li>
              <li>
                <strong>Service Providers:</strong> Third-party vendors who perform services on our
                behalf, such as payment processing, email delivery, and analytics
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law or to protect our rights,
                property, or safety
              </li>
              <li>
                <strong>Business Transfers:</strong> In connection with any merger, sale of company
                assets, or acquisition
              </li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We do not sell your personal information to third parties for their marketing
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
              destruction. These measures include:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 leading-relaxed mb-4 space-y-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security assessments and audits</li>
              <li>Access controls and authentication mechanisms</li>
              <li>Secure payment processing through PCI-DSS compliant providers</li>
              <li>Employee training on data protection and privacy</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              However, no method of transmission over the internet or electronic storage is 100%
              secure. While we strive to protect your personal information, we cannot guarantee its
              absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              6. Your Rights (GDPR Compliance)
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              Under the General Data Protection Regulation (GDPR) and other privacy laws, you have
              the following rights:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 leading-relaxed mb-4 space-y-2">
              <li>
                <strong>Right to Access:</strong> Request a copy of your personal data
              </li>
              <li>
                <strong>Right to Rectification:</strong> Correct inaccurate or incomplete data
              </li>
              <li>
                <strong>Right to Erasure:</strong> Request deletion of your personal data
              </li>
              <li>
                <strong>Right to Restrict Processing:</strong> Limit how we use your data
              </li>
              <li>
                <strong>Right to Data Portability:</strong> Receive your data in a portable format
              </li>
              <li>
                <strong>Right to Object:</strong> Object to certain types of processing
              </li>
              <li>
                <strong>Right to Withdraw Consent:</strong> Withdraw consent at any time
              </li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              To exercise these rights, please visit your account settings or contact us at the
              email address provided below.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              7. Cookies and Tracking Technologies
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We use cookies and similar tracking technologies to track activity on our platform and
              store certain information. Cookies are files with a small amount of data that are sent
              to your browser from a website and stored on your device.
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We use the following types of cookies:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 leading-relaxed mb-4 space-y-2">
              <li>
                <strong>Essential Cookies:</strong> Required for the platform to function properly
              </li>
              <li>
                <strong>Analytics Cookies:</strong> Help us understand how visitors use our platform
              </li>
              <li>
                <strong>Preference Cookies:</strong> Remember your settings and preferences
              </li>
              <li>
                <strong>Marketing Cookies:</strong> Track your browsing habits to show relevant ads
              </li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              You can instruct your browser to refuse all cookies or to indicate when a cookie is
              being sent. However, if you do not accept cookies, you may not be able to use some
              portions of our platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              8. Children&apos;s Privacy
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              Our services are designed for parents and guardians to book camp experiences for their
              children. We do not knowingly collect personal information directly from children
              under the age of 13 without parental consent.
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              Parents and guardians are responsible for providing accurate information about their
              children. If you believe we have inadvertently collected information from a child
              without proper consent, please contact us immediately, and we will take steps to
              remove that information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              9. Data Retention
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We retain your personal information for as long as necessary to fulfill the purposes
              outlined in this Privacy Policy, unless a longer retention period is required or
              permitted by law. Specifically:
            </p>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 leading-relaxed mb-4 space-y-2">
              <li>Account information is retained while your account is active</li>
              <li>Booking and transaction records are retained for 7 years for legal compliance</li>
              <li>Marketing communications data is retained until you unsubscribe</li>
              <li>Analytics data is typically retained for 2 years</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              When we no longer need your information, we will securely delete or anonymize it.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              10. International Data Transfers
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              Your information may be transferred to and maintained on computers located outside of
              your state, province, country, or other governmental jurisdiction where data
              protection laws may differ from those in your jurisdiction.
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We ensure that appropriate safeguards are in place to protect your personal
              information when it is transferred internationally, including the use of standard
              contractual clauses approved by the European Commission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              11. Changes to This Privacy Policy
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We may update our Privacy Policy from time to time. We will notify you of any changes
              by posting the new Privacy Policy on this page and updating the &quot;Last
              updated&quot; date at the top of this policy.
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              We will also notify you via email or through a prominent notice on our platform prior
              to the change becoming effective. You are advised to review this Privacy Policy
              periodically for any changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              12. Contact Us
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
              If you have any questions about this Privacy Policy or our data practices, please
              contact us at:
            </p>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Email:</strong> privacy@worldcamps.com
                <br />
                <strong>Address:</strong> World Camps, 123 Camp Street, Adventure City, AC 12345
                <br />
                <strong>Data Protection Officer:</strong> dpo@worldcamps.com
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
