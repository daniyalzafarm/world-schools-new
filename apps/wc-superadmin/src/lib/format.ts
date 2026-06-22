/** Returns `singular` when `count === 1`, otherwise `plural` (defaults to `singular + 's'`). */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural
}
