import { useAuthStore } from '@/stores/auth-store'
import { isSuperAdmin } from '@/utils/auth'

/**
 * Custom hook for accessing authentication state and actions
 * Provides a convenient interface to the auth store
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
    isSuperAdmin: isSuperAdmin(user),

    // Actions
    login,
    logout,
    refreshToken,
    getProfile,
    changePassword,
    clearError,
  }
}
