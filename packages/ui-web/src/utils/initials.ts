export const getInitials = (fullName?: string | null): string => {
  const tokens = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return '?'
  return tokens
    .slice(0, 2)
    .map(t => t[0])
    .join('')
    .toUpperCase()
}
