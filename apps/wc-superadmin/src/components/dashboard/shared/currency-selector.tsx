'use client'

import { Select, SelectItem, SelectSection } from '@heroui/react'
import { Globe } from 'lucide-react'

interface CurrencySelectorProps {
  currencies: string[]
  value: string | undefined
  onChange: (currency: string | undefined) => void
  loading?: boolean
  className?: string
}

const ALL_KEY = '__all__'

const CURRENCY_LABELS: Record<string, string> = {
  usd: '$ USD',
  eur: '€ EUR',
  gbp: '£ GBP',
  cad: 'CA$ CAD',
  aud: 'A$ AUD',
  nzd: 'NZ$ NZD',
  chf: 'CHF',
  sek: 'kr SEK',
  nok: 'kr NOK',
  dkk: 'kr DKK',
  sgd: 'S$ SGD',
  hkd: 'HK$ HKD',
  jpy: '¥ JPY',
}

export function CurrencySelector({
  currencies,
  value,
  onChange,
  loading = false,
  className = '',
}: CurrencySelectorProps) {
  if (loading) {
    return (
      <div
        className={`flex h-9 w-40 animate-pulse items-center justify-center rounded-md bg-default-100 text-xs text-default-400 ${className}`}
      >
        Currency…
      </div>
    )
  }

  const selectedKey = value ?? ALL_KEY

  return (
    <Select
      aria-label="Currency"
      size="sm"
      selectedKeys={[selectedKey]}
      onChange={e => {
        const key = e.target.value
        onChange(!key || key === ALL_KEY ? undefined : key)
      }}
      className={`w-40 shrink-0 ${className}`}
      classNames={{ trigger: 'h-9' }}
      renderValue={items =>
        items.map(item => {
          if (item.key === ALL_KEY) {
            return (
              <span key={item.key} className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                All Currencies
              </span>
            )
          }
          const code = String(item.key)
          return <span key={item.key}>{CURRENCY_LABELS[code] ?? code.toUpperCase()}</span>
        })
      }
    >
      <SelectSection showDivider>
        <SelectItem
          key={ALL_KEY}
          textValue="All Currencies"
          startContent={<Globe className="h-3.5 w-3.5" />}
        >
          All Currencies
        </SelectItem>
      </SelectSection>
      <SelectSection>
        {currencies.map(code => (
          <SelectItem key={code} textValue={CURRENCY_LABELS[code] ?? code.toUpperCase()}>
            {CURRENCY_LABELS[code] ?? code.toUpperCase()}
          </SelectItem>
        ))}
      </SelectSection>
    </Select>
  )
}
