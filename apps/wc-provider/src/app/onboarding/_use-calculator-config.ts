import { useEffect } from 'react'
import { type CalculatorConfig, useOnboardingStore } from '../../stores/onboarding-store'

/**
 * Provides the runtime currency + app fee percentage for the deposit-
 * settings and payment-policies preview calculators. Returns `null` while
 * the config is loading; consumers should render a skeleton/loading state
 * until a value resolves so we never flash a hardcoded fee that may not
 * match the provider's actual rate.
 *
 * Cached in the onboarding store: the first consumer triggers the fetch,
 * subsequent mounts (e.g. when navigating between onboarding steps) read
 * from the cache and never refetch.
 */
export function useCalculatorConfig(): CalculatorConfig | null {
  const calculatorConfig = useOnboardingStore(s => s.calculatorConfig)
  const fetchCalculatorConfig = useOnboardingStore(s => s.fetchCalculatorConfig)

  useEffect(() => {
    void fetchCalculatorConfig()
  }, [fetchCalculatorConfig])

  return calculatorConfig
}
