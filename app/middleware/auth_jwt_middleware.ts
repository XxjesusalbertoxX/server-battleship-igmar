import { HttpContext } from '@adonisjs/core/http'
import { verifyJwtToken } from '../utils/jwt_auth.js'

export default class AuthJwt {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    const { request, response } = ctx
    const authHeader = request.header('Authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return response.unauthorized({ message: 'Missing or invalid token' })
    }

    const token = authHeader.split(' ')[1]

    try {
      // Solo extrae el payload (ej: { id: "1" })
      ctx.authUser = verifyJwtToken(token)
      await next()
    } catch {
      return response.unauthorized({ message: 'Invalid or expired token' })
    }
  }
}
