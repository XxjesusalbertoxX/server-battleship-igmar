import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import User from '#models/user'

export default class RefreshToken extends BaseModel {
  @column({ isPrimary: true, columnName: 'id' })
  declare id: number

  @column({ columnName: 'token' })
  declare token: string

  @column({ columnName: 'user_id' })
  declare userId: number

  @column.dateTime({ columnName: 'expires_at' })
  declare expiresAt: DateTime

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: any
}
