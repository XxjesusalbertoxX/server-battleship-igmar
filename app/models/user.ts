import { DateTime } from 'luxon'
import { BaseModel, column, beforeSave } from '@adonisjs/lucid/orm'
import Hash from '@adonisjs/core/services/hash'

export default class User extends BaseModel {
  @column({ isPrimary: true, columnName: 'id' })
  declare id: number

  @column({ columnName: 'name' })
  declare name: string

  @column({ columnName: 'email' })
  declare email: string

  @column({ serializeAs: null, columnName: 'password' })
  declare password: string

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column({ columnName: 'wins' })
  declare wins: number

  @column({ columnName: 'losses' })
  declare losses: number

  @column({ columnName: 'precision' })
  declare precision: number

  @column({ columnName: 'exp' })
  declare exp: number

  @column({ columnName: 'level' })
  declare level: number

  // Opcional: método para soft delete
  async softDelete() {
    this.isActive = false
    await this.save()
  }

  @beforeSave()
  static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await Hash.make(user.password)
    }
  }

  static async findByEmail(email: string) {
    return this.query().where('email', email).first()
  }
}
