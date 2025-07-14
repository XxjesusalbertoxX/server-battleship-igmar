// database/migrations/xxxx_player_games.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class PlayerGames extends BaseSchema {
  protected tableName = 'player_games'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('game_id').unsigned().references('id').inTable('games').onDelete('CASCADE')
      table.unique(['user_id', 'game_id'])
      table.index(['game_id', 'ready'])

      table.json('board').nullable()
      table.enu('result', ['win', 'lose', 'pending']).defaultTo('pending')
      table.integer('ships_sunk').unsigned().defaultTo(0)
      table.integer('ships_lost').unsigned().defaultTo(0)
      table.timestamp('last_seen_at')
      table.boolean('ready').defaultTo(false)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
