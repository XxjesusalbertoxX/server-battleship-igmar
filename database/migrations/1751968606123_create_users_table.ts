import { BaseSchema } from '@adonisjs/lucid/schema'

export default class Users extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('email').notNullable().unique()
      table.string('password').notNullable()
      table.boolean('is_active').defaultTo(true)
      table.integer('wins').unsigned().defaultTo(0)
      table.integer('losses').unsigned().defaultTo(0)
      table.integer('exp').unsigned().defaultTo(1)
      table.integer('level').unsigned().defaultTo(1)
      table.timestamps(true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
