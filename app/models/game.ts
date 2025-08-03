// Re-exportar todos los modelos para mantener compatibilidad
export * from './game_base.js'
export * from './battleship/game_battleship.js'
export * from './simonsay/game_simon_say.js'
export * from './loteria/game_loteria.js' // <-- agregar

import { GameBaseModelClass } from './game_base.js'
import { GameBattleshipModelClass } from './battleship/game_battleship.js'
import { GameSimonSayModelClass } from './simonsay/game_simon_say.js'
import { GameLoteriaModelClass } from './loteria/game_loteria.js' // <-- agregar

// Clase unificada para usar en servicios
export class GameModel {
  private static _base: GameBaseModelClass | null = null
  private static _battleship: GameBattleshipModelClass | null = null
  private static _simonSay: GameSimonSayModelClass | null = null
  private static _loteria: GameLoteriaModelClass | null = null // <-- agregar

  static get base() {
    if (!this._base) {
      this._base = new GameBaseModelClass()
    }
    return this._base
  }

  static get loteria() {
    // <-- agregar
    if (!this._loteria) {
      this._loteria = new GameLoteriaModelClass()
    }
    return this._loteria
  }

  static get battleship() {
    if (!this._battleship) {
      this._battleship = new GameBattleshipModelClass()
    }
    return this._battleship
  }

  static get simonSay() {
    if (!this._simonSay) {
      this._simonSay = new GameSimonSayModelClass()
    }
    return this._simonSay
  }

  // Método factory para crear el tipo correcto
  static async createGame(gameType: 'battleship' | 'simonsay' | 'loteria', data: any) {
    switch (gameType) {
      case 'battleship':
        return this.battleship.create({
          ...data,
          gameType: 'battleship', // <-- gameType sigue siendo 'battleship' para tu lógica
          // Mongoose automáticamente pondrá _type: 'battleship' para el discriminador
        })
      case 'simonsay':
        return this.simonSay.create({
          ...data,
          gameType: 'simonsay', // <-- gameType sigue siendo 'simonsay' para tu lógica
          // Mongoose automáticamente pondrá _type: 'simonsay' para el discriminador
        })
      case 'loteria': // <-- agregar
        return this.loteria.create({
          ...data,
          gameType: 'loteria',
        }) // <-- gameType sigue siendo 'loteria
      default:
        throw new Error(`Tipo de juego no soportado: ${gameType}`)
    }
  }

  // Métodos generales (backward compatibility)
  static async find_by_id(id: string) {
    return this.base.find_by_id(id)
  }

  static async find_by_code(code: string) {
    return this.base.find_by_code(code)
  }

  static async update_by_id(id: string, data: any) {
    return this.base.update_by_id(id, data)
  }

  static async delete_by_id(id: string) {
    return this.base.delete_by_id(id)
  }

  static async find_by_player_game_id(playerGameId: any) {
    return this.base.find_one({ players: playerGameId })
  }
}

// Para mantener compatibilidad con el código existente
export { GameModel as default }
