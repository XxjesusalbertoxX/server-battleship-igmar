import { BaseSchema } from '@adonisjs/lucid/schema'

export default class Persons extends BaseSchema {
  protected tableName = 'people'

  async up() {
    this.schema.raw(`CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other')`)

    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('first_name').notNullable()
      table.string('last_name').notNullable()
      table.integer('age').nullable()

      // 🎯 Campo ENUM usando tipo personalizado
      table.specificType('genre', 'gender_enum').notNullable()

      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.boolean('is_active').defaultTo(true).notNullable()
      table.timestamps(true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw(`DROP TYPE gender_enum`)
  }
}
