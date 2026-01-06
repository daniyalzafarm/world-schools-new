/**
 * String formatting utilities for World Camps applications
 */

/**
 * Converts a snake_case string to Title Case with spaces
 * @param str - The snake_case string to format
 * @returns Formatted string in Title Case
 * @example
 * formatSnakeCaseToTitleCase('incomplete_information') // 'Incomplete Information'
 * formatSnakeCaseToTitleCase('invalid_documents') // 'Invalid Documents'
 */
export function formatSnakeCaseToTitleCase(str: string): string {
  if (!str) return ''
  
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

