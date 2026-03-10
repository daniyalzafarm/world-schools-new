import type { PrismaClient } from '../../src/generated/client/client'

export async function seedSupportTicketing(prisma: PrismaClient) {
  console.log('')
  console.log('Creating support ticketing configuration...')

  const standardSlaPolicy = await prisma.supportTicketSlaPolicy.upsert({
    where: { name: 'Standard Support' },
    update: {
      description: 'Default SLA for most support requests.',
      firstResponseTargetMinutes: 240, // 4 hours
      resolutionTargetMinutes: 2880, // 48 hours
      businessHoursOnly: true,
      businessTimeZone: 'Europe/Zurich',
      pauseOnPendingRequester: true,
      isActive: true,
    },
    create: {
      name: 'Standard Support',
      description: 'Default SLA for most support requests.',
      firstResponseTargetMinutes: 240, // 4 hours
      resolutionTargetMinutes: 2880, // 48 hours
      businessHoursOnly: true,
      businessTimeZone: 'Europe/Zurich',
      pauseOnPendingRequester: true,
      isActive: true,
    },
  })

  const urgentSlaPolicy = await prisma.supportTicketSlaPolicy.upsert({
    where: { name: 'Urgent Support' },
    update: {
      description: 'High-priority SLA for urgent payment and access issues.',
      firstResponseTargetMinutes: 60, // 1 hour
      resolutionTargetMinutes: 720, // 12 hours
      businessHoursOnly: true,
      businessTimeZone: 'Europe/Zurich',
      pauseOnPendingRequester: true,
      isActive: true,
    },
    create: {
      name: 'Urgent Support',
      description: 'High-priority SLA for urgent payment and access issues.',
      firstResponseTargetMinutes: 60, // 1 hour
      resolutionTargetMinutes: 720, // 12 hours
      businessHoursOnly: true,
      businessTimeZone: 'Europe/Zurich',
      pauseOnPendingRequester: true,
      isActive: true,
    },
  })

  const lowPrioritySlaPolicy = await prisma.supportTicketSlaPolicy.upsert({
    where: { name: 'Low Priority Support' },
    update: {
      description: 'SLA for informational, non-blocking requests.',
      firstResponseTargetMinutes: 720, // 12 hours
      resolutionTargetMinutes: 10080, // 7 days
      businessHoursOnly: true,
      businessTimeZone: 'Europe/Zurich',
      pauseOnPendingRequester: true,
      isActive: true,
    },
    create: {
      name: 'Low Priority Support',
      description: 'SLA for informational, non-blocking requests.',
      firstResponseTargetMinutes: 720, // 12 hours
      resolutionTargetMinutes: 10080, // 7 days
      businessHoursOnly: true,
      businessTimeZone: 'Europe/Zurich',
      pauseOnPendingRequester: true,
      isActive: true,
    },
  })

  const supportCategories = [
    {
      key: 'booking_issue',
      name: 'Booking Issues',
      description: 'Problems creating, updating, or managing camp bookings.',
      audience: 'BOTH' as const,
      defaultPriority: 'NORMAL' as const,
      defaultSlaPolicyId: standardSlaPolicy.id,
      sortOrder: 10,
    },
    {
      key: 'payment_refund',
      name: 'Payment & Refunds',
      description: 'Payment failures, refunds, invoices, and payout disputes.',
      audience: 'BOTH' as const,
      defaultPriority: 'HIGH' as const,
      defaultSlaPolicyId: urgentSlaPolicy.id,
      sortOrder: 20,
    },
    {
      key: 'technical_issue',
      name: 'Technical Support',
      description: 'Bugs, platform errors, and upload/performance issues.',
      audience: 'BOTH' as const,
      defaultPriority: 'HIGH' as const,
      defaultSlaPolicyId: standardSlaPolicy.id,
      sortOrder: 30,
    },
    {
      key: 'account_help',
      name: 'Account Help',
      description: 'Login, account access, profile, and security questions.',
      audience: 'BOTH' as const,
      defaultPriority: 'NORMAL' as const,
      defaultSlaPolicyId: standardSlaPolicy.id,
      sortOrder: 40,
    },
    {
      key: 'camp_question',
      name: 'Question About a Camp',
      description: 'General support questions about camp details and options.',
      audience: 'PARENT' as const,
      defaultPriority: 'LOW' as const,
      defaultSlaPolicyId: lowPrioritySlaPolicy.id,
      sortOrder: 50,
    },
    {
      key: 'payouts_payments',
      name: 'Payouts & Payments',
      description: 'Provider payout schedules, failed transfers, and payment setup.',
      audience: 'PROVIDER' as const,
      defaultPriority: 'HIGH' as const,
      defaultSlaPolicyId: urgentSlaPolicy.id,
      sortOrder: 60,
    },
    {
      key: 'managing_bookings',
      name: 'Managing Bookings',
      description: 'Provider-side booking confirmation, cancellations, and waitlists.',
      audience: 'PROVIDER' as const,
      defaultPriority: 'NORMAL' as const,
      defaultSlaPolicyId: standardSlaPolicy.id,
      sortOrder: 70,
    },
    {
      key: 'camp_listing_issue',
      name: 'Camp Listing Issue',
      description: 'Problems editing, publishing, or displaying camp listings.',
      audience: 'PROVIDER' as const,
      defaultPriority: 'NORMAL' as const,
      defaultSlaPolicyId: standardSlaPolicy.id,
      sortOrder: 80,
    },
    {
      key: 'sessions_availability',
      name: 'Sessions & Availability',
      description: 'Session setup, capacity mismatches, and availability conflicts.',
      audience: 'PROVIDER' as const,
      defaultPriority: 'NORMAL' as const,
      defaultSlaPolicyId: standardSlaPolicy.id,
      sortOrder: 90,
    },
    {
      key: 'verification_trust_score',
      name: 'Verification & Trust Score',
      description: 'Provider verification documents, review outcomes, and trust score.',
      audience: 'PROVIDER' as const,
      defaultPriority: 'NORMAL' as const,
      defaultSlaPolicyId: standardSlaPolicy.id,
      sortOrder: 100,
    },
    {
      key: 'stripe_account',
      name: 'Stripe Account',
      description: 'Stripe onboarding, connection, and account compliance support.',
      audience: 'PROVIDER' as const,
      defaultPriority: 'HIGH' as const,
      defaultSlaPolicyId: urgentSlaPolicy.id,
      sortOrder: 110,
    },
    {
      key: 'general_support',
      name: 'General Support',
      description: 'Catch-all category for requests that do not match another topic.',
      audience: 'BOTH' as const,
      defaultPriority: 'NORMAL' as const,
      defaultSlaPolicyId: standardSlaPolicy.id,
      sortOrder: 120,
    },
  ]

  for (const category of supportCategories) {
    await prisma.supportTicketCategory.upsert({
      where: { key: category.key },
      update: {
        name: category.name,
        description: category.description,
        audience: category.audience,
        defaultPriority: category.defaultPriority,
        defaultSlaPolicyId: category.defaultSlaPolicyId,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: {
        key: category.key,
        name: category.name,
        description: category.description,
        audience: category.audience,
        defaultPriority: category.defaultPriority,
        defaultSlaPolicyId: category.defaultSlaPolicyId,
        sortOrder: category.sortOrder,
        isActive: true,
      },
    })
  }

  console.log(
    `✅ Created support ticketing configuration: 3 SLA policies, ${supportCategories.length} categories`
  )
}
