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
  public async getUser({ authUser, response }: HttpContext) {
    const userId = authUser?.id
    if (!userId) {
      return response.unauthorized({ message: 'Unauthorized' })
    }

    const user = await User.find(userId)
    if (!user) {
      return response.notFound({ message: 'User not found' })
    }

    return response.ok({ user })
  }

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
    const { refreshToken, accessToken } = request.only(['refreshToken', 'accessToken'])

    // CAMBIO PRINCIPAL: Validar que ambos tokens sean proporcionados
    if (!refreshToken || !accessToken) {
      return response.status(400).json({
        message: 'Both refresh token and access token are required',
      })
    }

    // 1. Verificar que el refresh token existe y es válido en BD
    const record = await RefreshToken.query().where('token', refreshToken).first()
    if (!record) {
      console.warn('[Auth] Refresh token not found in database')
      return response.status(401).json({ message: 'Invalid refresh token' })
    }

    if (record.expiresAt < DateTime.now()) {
      console.warn('[Auth] Refresh token expired')
      await record.delete()
      return response.status(401).json({ message: 'Refresh token expired' })
    }

    // 2. NUEVO: Verificar que el access token sea válido estructuralmente (no expirado)
    try {
      const accessPayload = verifyJwtToken(accessToken) as { id: string }
      const refreshPayload = verifyJwtToken(refreshToken) as { id: string }

      // 3. Verificar que ambos tokens pertenezcan al mismo usuario
      if (accessPayload.id !== refreshPayload.id) {
        console.warn('[Auth] Token mismatch: different users')
        await record.delete()
        return response.status(401).json({ message: 'Token mismatch' })
      }

      // 4. SOLO renovar el tiempo del access token (mismo payload, nueva expiración)
      const newAccessToken = signJwt({ id: accessPayload.id }, ACCESS_EXPIRES_IN)

      console.log('[Auth] Access token time refreshed successfully for user:', accessPayload.id)
      return response.ok({ accessToken: newAccessToken })
    } catch (error) {
      console.error('[Auth] Error verifying tokens:', error)

      // Si el access token está corrupto o inválido, no renovar
      if (error.message?.includes('expired')) {
        return response.status(401).json({
          message: 'Access token expired. Please login again.',
        })
      }

      return response.status(401).json({
        message: 'Invalid token structure',
      })
    }
  }

  public async verify({ request, response }: HttpContext) {
    const authHeader = request.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return response.unauthorized({ message: 'Missing token' })
    }

    const token = authHeader.split(' ')[1]
    try {
      const payload = verifyJwtToken(token)
      return response.ok({ valid: true, payload })
    } catch (error) {
      return response.unauthorized({
        message: 'Invalid or expired token',
        error: error.message,
      })
    }
  }
}
