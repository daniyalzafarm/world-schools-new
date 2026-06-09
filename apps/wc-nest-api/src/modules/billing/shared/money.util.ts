import { Prisma } from '../../../generated/client/client'

type DecimalLike = Prisma.Decimal | string | number

/**
 * ISO 4217 codes whose minor unit is the same as the major unit (no decimals).
 * Stripe expects amounts in the smallest indivisible unit, which means JPY/KRW/etc.
 * are already integer "yen" / "won" — multiplying by 100 would overcharge by 100x.
 *
 * Source: https://stripe.com/docs/currencies#zero-decimal — kept lowercase to
 * match how we already store currency on ProviderSettings.currency.
 */
const ZERO_DECIMAL_CURRENCIES = new Set<string>([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
])

/**
 * Three-decimal currencies (rare; Stripe still bills these in the smallest
 * unit, e.g. fils for KWD = 1/1000 dinar).
 */
const THREE_DECIMAL_CURRENCIES = new Set<string>(['bhd', 'jod', 'kwd', 'omr', 'tnd'])

function minorUnitFactor(currency: string): number {
  const lower = currency.toLowerCase()
  if (ZERO_DECIMAL_CURRENCIES.has(lower)) return 1
  if (THREE_DECIMAL_CURRENCIES.has(lower)) return 1000
  return 100
}

function toDecimal(value: DecimalLike): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value as string | number)
}

/**
 * Converts a decimal amount in the major unit (the value we store in
 * `Payment.amount`, `Refund.amount`, etc.) into Stripe's smallest indivisible
 * unit suitable for `paymentIntents.create`, `refunds.create`, etc.
 *
 * We accept a Prisma `Decimal` directly so callers don't need to call
 * `.toNumber()` themselves — that lossy conversion is a well-known footgun
 * and should never be in business code that touches money.
 *
 * Throws if the result is not a finite integer — that means the input has
 * more decimal places than the currency's minor unit allows, which is always
 * a bug at the call site (we should never charge fractional cents).
 */
export function toStripeMinorUnits(amount: DecimalLike, currency: string): number {
  const factor = minorUnitFactor(currency)
  const decimal = toDecimal(amount)
  const minor = decimal.mul(factor)
  if (!minor.isInteger()) {
    throw new Error(
      `Cannot convert ${decimal.toString()} ${currency.toUpperCase()} to Stripe minor units: result is not an integer`
    )
  }
  const value = minor.toNumber()
  if (!Number.isFinite(value)) {
    throw new Error(`Stripe minor-unit conversion overflowed for ${decimal.toString()} ${currency}`)
  }
  return value
}

/**
 * Inverse of `toStripeMinorUnits` — converts Stripe's smallest unit back to
 * the major unit string we persist. Returned as a string so the caller can
 * store it directly into a `Decimal` column without going through float.
 */
export function fromStripeMinorUnits(amount: number, currency: string): string {
  const factor = minorUnitFactor(currency)
  const decimals = factor === 1 ? 0 : factor === 1000 ? 3 : 2
  return new Prisma.Decimal(amount).div(factor).toFixed(decimals)
}

/**
 * Computes `applicationFeeAmount` for a Payment in the booking currency.
 *
 * The app fee percentage is the snapshotted `Provider.appFeePercentage`
 * (or the snapshot stored on `BookingGroup.appFeePercentageSnapshot` for
 * refund-time math).
 *
 * Returned as a string for `Decimal(12,2)` storage; the call site converts
 * to Stripe minor units only when handing the value to the SDK. Rounded
 * half-up — banker's rounding would skew the platform's take over time at scale.
 */
export function computeApplicationFee(amount: DecimalLike, appFeePercentage: DecimalLike): string {
  return toDecimal(amount)
    .mul(toDecimal(appFeePercentage))
    .div(100)
    .toFixed(2, Prisma.Decimal.ROUND_HALF_UP)
}

/**
 * M2 audit fix: Stripe's minimum charge amount per currency. Below these
 * thresholds Stripe rejects `paymentIntents.create` with
 * `amount_too_small`. Returned in the **major** unit (€/$/¥) for direct
 * use by validation / form layers.
 *
 * Source: https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts
 * Kept in sync with the table there. Defaults to 0.50 in the currency's
 * major unit when the currency isn't enumerated — that matches Stripe's
 * default for USD-like currencies and is conservative for the long tail.
 */
const STRIPE_MIN_CHARGE_MAJOR: Record<string, number> = {
  // Zero-decimal currencies are quoted in their major (integer) unit
  bif: 50,
  clp: 50,
  djf: 50,
  gnf: 50,
  jpy: 50,
  kmf: 50,
  krw: 50,
  mga: 50,
  pyg: 50,
  rwf: 50,
  ugx: 50,
  vnd: 50,
  vuv: 50,
  xaf: 50,
  xof: 50,
  xpf: 50,
  // Three-decimal currencies (Stripe says the minimum is the equivalent
  // of $0.50 USD; keep at 0.5 in the major unit for predictability).
  bhd: 0.5,
  jod: 0.5,
  kwd: 0.5,
  omr: 0.5,
  tnd: 0.5,
  // Two-decimal currencies — explicit list per the Stripe docs table.
  usd: 0.5,
  aed: 2.0,
  aud: 0.5,
  bgn: 1.0,
  brl: 0.5,
  cad: 0.5,
  chf: 0.5,
  cny: 4.0,
  czk: 15.0,
  dkk: 2.5,
  eur: 0.5,
  gbp: 0.3,
  hkd: 4.0,
  huf: 175.0,
  inr: 0.5,
  mxn: 10.0,
  myr: 2.0,
  nok: 3.0,
  nzd: 0.5,
  pln: 2.0,
  ron: 2.0,
  sek: 3.0,
  sgd: 0.5,
  thb: 10.0,
  zar: 5.0,
}

/**
 * M2 audit fix: returns the Stripe-imposed minimum charge amount in the
 * major unit for the given currency. Use this to gate provider settings
 * (e.g. fixed deposit amount) so providers can't configure values that
 * will fail at PaymentIntent create time with `amount_too_small`.
 *
 * Defaults to 0.50 (in major units) when the currency isn't explicitly
 * listed — that matches Stripe's USD baseline and is conservative.
 */
export function getStripeMinimumChargeAmount(currency: string): number {
  return STRIPE_MIN_CHARGE_MAJOR[currency.toLowerCase()] ?? 0.5
}
