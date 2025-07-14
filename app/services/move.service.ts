import { MoveModel as BattleshipMoveModel } from '../models/battleship_move.js'
import { MoveSimonDiceModel } from '../models/simon_dice_move.js'
import { GameModel } from '../models/game.js'

export default class MoveService {
  private battleshipMoveModel = new BattleshipMoveModel()
  private simonDiceMoveModel = new MoveSimonDiceModel()
  private gameModel = new GameModel()

  async createMove(playerGameId: any, moveData: any) {
    const game = await this.gameModel.find_by_player_game_id(playerGameId)
    if (!game) throw new Error('Partida no encontrada')

    if (game.gameTypeId === 1) {
      // Battleship
      return this.battleshipMoveModel.create({
        playerGameId,
        x: moveData.x,
        y: moveData.y,
        hit: moveData.hit,
      })
    } else if (game.gameTypeId === 2) {
      // Simon Dice
      return this.simonDiceMoveModel.create({
        playerGameId,
        sequence: moveData.sequence,
      })
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }

  async getMovesByPlayerGame(playerGameId: any) {
    const game = await this.gameModel.find_by_player_game_id(playerGameId)
    if (!game) throw new Error('Partida no encontrada')

    if (game.gameTypeId === 1) {
      return this.battleshipMoveModel.find_all({ playerGameId })
    } else if (game.gameTypeId === 2) {
      return this.simonDiceMoveModel.find_all({ playerGameId })
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }
}
