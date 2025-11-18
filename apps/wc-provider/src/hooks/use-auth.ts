import { useAuthStore } from '@/stores/auth-store'
import { isProviderAdmin, hasProviderRole, isAuthorizedProviderUser } from '@/utils/auth'

/**
 * Custom hook for accessing authentication state and actions
 * Provides a convenient interface to the auth store for provider app
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
    isProviderAdmin: isProviderAdmin(user),
    hasProviderRole: hasProviderRole(user),
    isAuthorizedProviderUser: isAuthorizedProviderUser(user),

    // Actions
    login,
    logout,
    refreshToken,
    getProfile,
    changePassword,
    clearError,
  }
}
