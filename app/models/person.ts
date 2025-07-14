import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import User from '#models/user'

export default class Person extends BaseModel {
  @column({ isPrimary: true, columnName: 'id' })
  declare id: number

  @column({ columnName: 'first_name' })
  declare firstName: string

  @column({ columnName: 'last_name' })
  declare lastName: string

  @column({ columnName: 'age' })
  declare age?: number

  @column({ columnName: 'genre' })
  declare genre: string

  @column({ columnName: 'user_id' })
  declare userId: number

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  // Opcional: método para soft delete
  async softDelete() {
    this.isActive = false
    await this.save()
  }

  @belongsTo(() => User, { foreignKey: 'user_id' })
  declare user: any

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
}
