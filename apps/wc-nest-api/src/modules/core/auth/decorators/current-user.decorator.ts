import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

/**
 * Minimum shape of `request.user` after JWT auth — what `validateUser` →
 * `buildUserResponse` always produces. Controllers can extend or narrow as
 * needed but should NOT use `any` for new code.
 *
 * Kept narrow on purpose: `id` and `email` are stable; the response also
 * carries name, address, roles[], permissions[] etc. but those are
 * impersonation-aware and shouldn't be relied on as a stable type contract.
 */
export interface CurrentUserPayload {
  id: string
  email: string
  roles?: Array<{ id: string; name: string; providerId: string | null; isSystemRole: boolean }>
  permissions?: string[]
}

export const CurrentUser = createParamDecorator((data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest()
  const user = request.user

  return data ? user?.[data] : user
})
