// Re-exportar todos los modelos para mantener compatibilidad
export * from './player_game_base.js'
export * from './battleship/player_game_battleship.js'
export * from './simonsay/player_game_simon_say.js'
export * from './loteria/player_game_loteria.js' // <-- agregar

import { PlayerGameBaseModelClass } from './player_game_base.js'
import { PlayerGameBattleshipModelClass } from './battleship/player_game_battleship.js'
import { PlayerGameSimonSayModelClass } from './simonsay/player_game_simon_say.js'
import { PlayerGameLoteriaModelClass } from './loteria/player_game_loteria.js' // <-- agregar

// Clase unificada para usar en servicios
export class PlayerGameModel {
  private static _base: PlayerGameBaseModelClass | null = null
  private static _battleship: PlayerGameBattleshipModelClass | null = null
  private static _simonSay: PlayerGameSimonSayModelClass | null = null
  private static _loteria: PlayerGameLoteriaModelClass | null = null // <-- agregar

  static get base() {
    if (!this._base) {
      this._base = new PlayerGameBaseModelClass()
    }
    return this._base
  }

  static get loteria() {
    // <-- agregar
    if (!this._loteria) {
      this._loteria = new PlayerGameLoteriaModelClass()
    }
    return this._loteria
  }

  static get battleship() {
    if (!this._battleship) {
      this._battleship = new PlayerGameBattleshipModelClass()
    }
    return this._battleship
  }

  static get simonSay() {
    if (!this._simonSay) {
      this._simonSay = new PlayerGameSimonSayModelClass()
    }
    return this._simonSay
  }

  // Método factory para crear el tipo correcto
  static async createPlayer(gameType: 'battleship' | 'simonsay' | 'loteria', data: any) {
    switch (gameType) {
      case 'battleship':
        return this.battleship.create({
          ...data,
          gameType: 'battleship', // <-- gameType sigue siendo 'battleship' para tu lógica
          // Mongoose automáticamente pondrá _type: 'player-battleship' para el discriminador
        })
      case 'simonsay':
        return this.simonSay.create({
          ...data,
          gameType: 'simonsay', // <-- gameType sigue siendo 'simonsay' para tu lógica
          // Mongoose automáticamente pondrá _type: 'player-simonsay' para el discriminador
        })
      case 'loteria':
        return this.loteria.create({
          ...data,
          gameType: 'loteria',
        }) // <-- gameType sigue siendo 'loteria
      default:
        throw new Error(`Tipo de juego no soportado: ${gameType}`)
    }
  }

  // Método para buscar jugadores por tipo de juego
  static async findPlayersByGame(gameId: string, gameType: 'battleship' | 'simonsay') {
    switch (gameType) {
      case 'battleship':
        return this.battleship.findByGameId(gameId)
      case 'simonsay':
        return this.simonSay.findByGameId(gameId)
      default:
        throw new Error(`Tipo de juego no soportado: ${gameType}`)
    }
  }

  // Método general para buscar jugadores (cualquier tipo)
  static async findPlayersByGameGeneral(gameId: string) {
    return this.base.find_many({ gameId })
  }
}
