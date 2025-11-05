import { useAuthStore } from '@/stores/auth-store'
import { isAdmin } from '@/utils/auth'

/**
 * Hook to check if the current user is an admin
 */
export function useAdmin() {
  const { user, isAuthenticated } = useAuthStore()

  return {
    isAdmin: isAuthenticated && isAdmin(user),
    user,
    isAuthenticated,
  }
}
