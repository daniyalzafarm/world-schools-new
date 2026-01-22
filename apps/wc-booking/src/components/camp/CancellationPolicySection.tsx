import { Card, CardBody } from '@heroui/react'

type CancellationPolicyType = 'flexible' | 'moderate' | 'strict' | 'custom'

interface CancellationPolicySectionProps {
  policy: CancellationPolicyType
  customPolicy?: any
}

// Standard policy templates - must match provider onboarding templates exactly
const POLICY_TEMPLATES = {
  flexible: {
    title: 'Flexible',
    description: 'Full refund if cancelled 7+ days before start',
    rules: [
      { label: '7+ days before:', detail: '100% refund' },
      { label: '3-6 days before:', detail: '50% refund' },
      { label: 'Less than 3 days:', detail: 'No refund' },
    ],
  },
  moderate: {
    title: 'Moderate',
    description: 'Full refund if cancelled 14+ days before start',
    rules: [
      { label: '14+ days before:', detail: '100% refund' },
      { label: '7-13 days before:', detail: '50% refund' },
      { label: 'Less than 7 days:', detail: 'No refund' },
    ],
  },
  strict: {
    title: 'Strict',
    description: 'Full refund if cancelled 30+ days before start',
    rules: [
      { label: '30+ days before:', detail: '100% refund' },
      { label: '14-29 days before:', detail: '50% refund' },
      { label: 'Less than 14 days:', detail: 'No refund' },
    ],
  },
}

export function CancellationPolicySection({
  policy,
  customPolicy,
}: CancellationPolicySectionProps) {
  // Use custom policy if provided, otherwise use standard template
  const policyData = policy === 'custom' && customPolicy ? customPolicy : POLICY_TEMPLATES[policy]

  if (!policyData) {
    return null
  }

  return (
    <div className="mb-12 pb-8 border-b border-gray-300">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Cancellation Policy</h2>

      <Card shadow="none" className="border border-gray-200">
        <CardBody className="p-6">
          {/* Policy Rules */}
          <div className="space-y-4">
            {policyData.rules?.map((rule: any, index: number) => (
              <div key={index}>
                {index === 0 ? (
                  <div>
                    <span className="text-base font-bold text-gray-900">{rule.label}</span>{' '}
                    <span className="text-base text-gray-900">{rule.detail}</span>
                  </div>
                ) : (
                  <div className="text-base text-gray-900">
                    {rule.label} {rule.detail}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* View Full Terms Link */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              className="text-base font-semibold text-gray-900 underline hover:text-gray-700 transition-colors"
              onClick={() => {
                // TODO: Implement view full terms functionality
                console.log('View full terms clicked')
              }}
            >
              View full terms & conditions
            </button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
