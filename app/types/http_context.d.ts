// types/http_context.d.ts
import { HttpContext } from '@adonisjs/core/http'
import type { AuthPayload } from '#utils/jwt_auth'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    authUser: AuthPayload
  }
}
