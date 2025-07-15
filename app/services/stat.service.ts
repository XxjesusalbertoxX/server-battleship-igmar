import { Types } from 'mongoose'
import { PlayerGameModel } from '../models/player_game.js'
import { GameModel } from '../models/game.js'
import { MoveModel } from '../models/battleship_move.js'

export class StatService {
  private playerGameModel = new PlayerGameModel()
  private gameModel = new GameModel()
  private moveModel = new MoveModel()

  public async getBattleshipStats(userId: number) {
    const playerGames = await this.playerGameModel.find_many({ userId })

    const wonGames: any[] = []
    const lostGames: any[] = []

    for (const pg of playerGames) {
      if (pg.result !== 'win' && pg.result !== 'lose') continue

      const game = await this.gameModel.find_by_id(pg.gameId.toString())
      if (!game || game.gameType !== 'battleship') continue

      const opponentId = game.players.find((id) => !id.equals(pg._id))
      const opponent = opponentId
        ? await this.playerGameModel.find_by_id(opponentId.toString())
        : null

      const summary = {
        gameId: game._id.toString(),
        code: game.code,
        date: game.createdAt,
        shipsSunk: pg.shipsSunk,
        shipsLost: pg.shipsLost,
        opponentUserId: opponent?.userId || null,
      }

      if (pg.result === 'win') wonGames.push(summary)
      if (pg.result === 'lose') lostGames.push(summary)
    }

    return {
      wins: wonGames.length,
      losses: lostGames.length,
      wonGames,
      lostGames,
    }
  }

  public async getGameDetails(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game || game.gameType !== 'battleship') throw new Error('Partida no válida')

    const playerGames = await this.playerGameModel.find_many({ gameId: new Types.ObjectId(gameId) })

    const myPlayerGame = playerGames.find((pg) => pg.userId === userId)
    const opponentPlayerGame = playerGames.find((pg) => pg.userId !== userId)

    if (!myPlayerGame) throw new Error('No perteneces a esta partida')

    const moves = await this.moveModel.find_many({ playerGameId: myPlayerGame._id })

    return {
      gameId: game._id.toString(),
      board: myPlayerGame.board || [],
      opponentBoard: opponentPlayerGame?.board || null,
      result: myPlayerGame.result,
      shipsSunk: myPlayerGame.shipsSunk,
      shipsLost: myPlayerGame.shipsLost,
      moves,
    }
  }
}
