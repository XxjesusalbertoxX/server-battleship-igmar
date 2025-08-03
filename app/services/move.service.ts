import { MoveModel as BattleshipMoveModel } from '../models/battleship_move.js'
import { GameModel } from '../models/game.js'

export default class MoveService {
  private battleshipMoveModel = new BattleshipMoveModel()
  private gameModel = GameModel.base

  async createMove(playerGameId: any, moveData: any) {
    const game = await this.gameModel.find_one({ players: playerGameId })
    if (!game) throw new Error('Partida no encontrada')

    if (game.gameType === 'battleship') {
      return this.battleshipMoveModel.create({
        playerGameId,
        x: moveData.x,
        y: moveData.y,
        hit: moveData.hit,
      })
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }

  async getMovesByPlayerGame(playerGameId: any) {
    const game = await this.gameModel.find_one({ players: playerGameId })
    if (!game) throw new Error('Partida no encontrada')

    if (game.gameType === 'battleship') {
      return this.battleshipMoveModel.find_all({ playerGameId })
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }

  async getMoveStats(playerGameId: any) {
    const game = await this.gameModel.find_one({ players: playerGameId })
    if (!game) throw new Error('Partida no encontrada')

    if (game.gameType === 'battleship') {
      const moves = await this.battleshipMoveModel.find_all({ playerGameId })
      const hits = moves.filter((move: any) => move.hit).length
      const misses = moves.filter((move: any) => !move.hit).length

      return {
        totalMoves: moves.length,
        hits,
        misses,
        accuracy: moves.length > 0 ? (hits / moves.length) * 100 : 0,
      }
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }

  async getLastMove(playerGameId: any) {
    const game = await this.gameModel.find_one({ players: playerGameId })
    if (!game) throw new Error('Partida no encontrada')

    if (game.gameType === 'battleship') {
      const moves = await this.battleshipMoveModel.find_all({ playerGameId })
      return moves.length > 0 ? moves[moves.length - 1] : null
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }
}
