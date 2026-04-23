export const formatRating = (rating: number | null | undefined): string =>
  rating == null ? '0.0' : (Math.round(rating * 10) / 10).toFixed(1)

export const formatReviewCount = (n: number): string =>
  new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
