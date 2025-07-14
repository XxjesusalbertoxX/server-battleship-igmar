// utils/jwt_auth.ts
import jwt, { JwtPayload } from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret'

export interface AuthPayload extends JwtPayload {
  id: string
}

export function signJwt(payload: Partial<AuthPayload>, expiresIn: string): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any })
}

export function verifyJwtToken(token: string): AuthPayload {
  const decoded = jwt.verify(token, JWT_SECRET)

  if (typeof decoded !== 'object' || decoded === null || !('id' in decoded)) {
    throw new Error('Invalid token payload')
  }

  return decoded as AuthPayload
}
