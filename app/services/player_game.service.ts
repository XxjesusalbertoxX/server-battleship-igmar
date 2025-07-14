import { PlayerGameModel } from '../models/player_game.js'
import { Types } from 'mongoose'

export default class PlayerGameService {
  private playerGameModel = new PlayerGameModel()

  async setReady(userId: number, gameId: string) {
    const playerGame = (await this.playerGameModel.find_one({
      userId,
      gameId: new Types.ObjectId(gameId),
    })) as any
    if (!playerGame) throw new Error('Jugador no encontrado en la partida')

    playerGame.ready = true
    playerGame.lastSeenAt = new Date()
    await this.playerGameModel.update_by_id(playerGame._id.toString(), playerGame)

    return true
  }

  async surrender(userId: number, gameId: string) {
    const playerGame = await this.playerGameModel.find_one({
      userId,
      gameId: new Types.ObjectId(gameId),
    })
    if (!playerGame) throw new Error('Jugador no encontrado en la partida')

    await this.playerGameModel.delete_by_id(playerGame._id.toString())

    // Puedes retornar un mensaje o booleano para saber que se rindió
    return { message: 'Has abandonado la partida' }
  }

  async heartbeat(userId: number, gameId: string) {
    const playerGame = await this.playerGameModel.find_one({
      userId,
      gameId: new Types.ObjectId(gameId),
    })
    if (!playerGame) throw new Error('No estás en esta partida')

    playerGame.lastSeenAt = new Date()
    await this.playerGameModel.update_by_id(playerGame._id.toString(), playerGame)

    return { message: 'Activo' }
  }

  async findPlayerInGame(userId: number, gameId: string) {
    return await this.playerGameModel.find_one({ userId, gameId: new Types.ObjectId(gameId) })
  }
}
