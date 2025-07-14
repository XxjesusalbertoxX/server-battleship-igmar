// database/migrations/xxxx_moves.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class Moves extends BaseSchema {
  protected tableName = 'moves'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('player_game_id')
        .unsigned()
        .references('id')
        .inTable('player_games')
        .onDelete('CASCADE')
      table.integer('x').unsigned().notNullable()
      table.integer('y').unsigned().notNullable()
      table.boolean('hit').notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
