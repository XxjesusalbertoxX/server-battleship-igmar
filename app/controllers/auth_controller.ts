// File: app/Controllers/Http/AuthController.ts
import { HttpContext } from '@adonisjs/core/http'
import User from '../models/user.js'
import RefreshToken from '../models/refresh_token.js'
import { signJwt, verifyJwtToken } from '../utils/jwt_auth.js'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'

const ACCESS_EXPIRES_IN = '15m'
const REFRESH_EXPIRES_IN = '7d'

export default class AuthController {
  public async register({ request, response }: HttpContext) {
    const { name, email, password } = request.only(['name', 'email', 'password'])
    const exists = await User.query().where('email', email).first()
    if (exists) {
      return response.badRequest({ message: 'Email already exists' })
    }

    const user = await User.create({ name, email, password })
    return response.created({ id: user.id, name: user.name, email: user.email })
  }

  public async login({ request, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])
    const user = await User.query().where('email', email).first()
    if (!user) {
      return response.unauthorized({ message: 'Invalid credentials' })
    }

    const validPassword = await hash.verify(user.password, password)
    if (!validPassword) {
      return response.unauthorized({ message: 'Invalid credentials' })
    }

    // Generate tokens with string IDs
    const accessToken = signJwt({ id: user.id.toString() }, ACCESS_EXPIRES_IN)
    const refreshTokenPayload = { id: user.id.toString() }
    const refreshToken = signJwt(refreshTokenPayload, REFRESH_EXPIRES_IN)

    // Persist refresh token
    await RefreshToken.create({
      token: refreshToken,
      userId: user.id,
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    return response.ok({ accessToken, refreshToken })
  }

  public async refresh({ request, response }: HttpContext) {
    const { refreshToken } = request.only(['refreshToken'])
    const record = await RefreshToken.query().where('token', refreshToken).first()
    if (!record || record.expiresAt < DateTime.now()) {
      return response.unauthorized({ message: 'Invalid refresh token' })
    }

    try {
      const payload = verifyJwtToken(refreshToken) as { id: string }
      const newAccessToken = signJwt({ id: payload.id }, ACCESS_EXPIRES_IN)
      return response.ok({ accessToken: newAccessToken })
    } catch {
      return response.unauthorized({ message: 'Invalid refresh token' })
    }
  }

  public async verify({ request, response }: HttpContext) {
    const authHeader = request.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return response.unauthorized({ message: 'Missing token' })
    }

    const token = authHeader.split(' ')[1]
    try {
      verifyJwtToken(token)
      return response.ok({ valid: true })
    } catch {
      return response.unauthorized({ message: 'Invalid or expired token' })
    }
  }
}
