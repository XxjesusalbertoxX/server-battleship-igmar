// database/migrations/xxxx_games.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class Games extends BaseSchema {
  protected tableName = 'games'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .enu('status', ['waiting', 'started', 'in_progres', 'finished'])
        .defaultTo('waiting')
        .notNullable()

      table
        .integer('current_turn_user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.string('code').unique().notNullable()
      table.boolean('has_started').defaultTo(false)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
