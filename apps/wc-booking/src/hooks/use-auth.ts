import { useAuthStore } from '@/stores/auth-store'
import { isAuthorizedBookingUser, isParent } from '@/utils/auth'

/**
 * Custom hook for accessing authentication state and actions
 * Provides a convenient interface to the auth store for booking app
 */
export function useAuth() {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refreshToken,
    getProfile,
    changePassword,
    clearError,
  } = useAuthStore()

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,
    isParent: isParent(user),
    isAuthorizedBookingUser: isAuthorizedBookingUser(user),

    // Actions
    login,
    logout,
    refreshToken,
    getProfile,
    changePassword,
    clearError,
  }
}
