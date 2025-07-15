import { Types } from 'mongoose'
import { PlayerGameModel, PlayerGameDoc } from '../models/player_game.js'
import { GameModel } from '#models/game'

// Errores específicos para manejo más claro
class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export default class PlayerGameService {
  private playerGameModel = new PlayerGameModel()
  private gameModel = new GameModel()
  private HEARTBEAT_THRESHOLD_MS = 30 * 1000 // 30 segundos

  private toObjectId(id: string) {
    try {
      return new Types.ObjectId(id)
    } catch {
      throw new Error('ID de juego inválido')
    }
  }

  async playerExistsInGame(userId: number, gameId: Types.ObjectId): Promise<boolean> {
    const playerGame = await this.playerGameModel.find_one({ userId, gameId })
    return !!playerGame
  }

  // Marca al jugador como listo y actualiza último visto
  async setReady(userId: number, gameId: string): Promise<boolean> {
    const objId = this.toObjectId(gameId)
    const playerGame = await this.findPlayerInGame(userId, objId)
    if (!playerGame) throw new Error('Jugador no encontrado en la partida')

    if (playerGame.ready) {
      return true
    }

    playerGame.ready = true
    playerGame.lastSeenAt = new Date()

    await this.playerGameModel.update_by_id(playerGame._id.toString(), playerGame)

    return true
  }

  // Marca rendición en lugar de eliminar para mantener historial
  // Marca rendición o abandona del lobby
  async surrender(userId: number, gameId: string): Promise<{ surrendered: boolean }> {
    const objId = this.toObjectId(gameId)
    const playerGame = await this.findPlayerInGame(userId, objId)
    if (!playerGame) throw new NotFoundError('Jugador no encontrado en la partida')

    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new NotFoundError('Juego no encontrado')

    // Si aún estamos en el lobby, simplemente elimino al jugador
    if (game.status === 'waiting') {
      await this.playerGameModel.delete_by_id(playerGame._id.toString())

      // También quito su referencia de Game.players
      game.players = game.players.filter((pid) => !pid.equals(playerGame._id))
      await this.gameModel.update_by_id(gameId, { players: game.players })

      return { surrendered: true }
    }

    // Si la partida ya empezó, esto cuenta como rendición: marca como 'lose'
    if (game.status === 'in_progress' || game.status === 'started') {
      playerGame.result = 'lose'
      await this.playerGameModel.update_by_id(playerGame._id.toString(), playerGame)

      // Actualizar lista de rendiciones en el juego
      game.surrenderedBy = game.surrenderedBy || []
      if (!game.surrenderedBy.find((id) => id.equals(playerGame._id))) {
        game.surrenderedBy.push(playerGame._id)
        await this.gameModel.update_by_id(gameId, { surrenderedBy: game.surrenderedBy })
      }

      // Opcional: si solo quedan un jugador activo, podrías finalizar la partida aquí
      // …

      return { surrendered: true }
    }

    // Si el juego ya está terminado, no tiene sentido rendirse
    throw new Error('No se puede rendir en una partida finalizada')
  }

  // Actualiza heartbeat solo si pasó el umbral
  async heartbeat(userId: number, gameId: string): Promise<{ active: boolean }> {
    const objId = this.toObjectId(gameId)
    const playerGame = await this.findPlayerInGame(userId, objId)
    if (!playerGame) throw new NotFoundError('Jugador no encontrado en la partida')

    const now = new Date()
    if (
      !playerGame.lastSeenAt ||
      now.getTime() - playerGame.lastSeenAt.getTime() > this.HEARTBEAT_THRESHOLD_MS
    ) {
      playerGame.lastSeenAt = now
      await this.playerGameModel.update_by_id(playerGame._id.toString(), playerGame)
    }

    return { active: true }
  }

  // Útil para buscar y validar existencia del jugador en una partida
  async findPlayerInGame(userId: number, gameId: Types.ObjectId): Promise<PlayerGameDoc> {
    const playerGame = await this.playerGameModel.find_one({ userId, gameId })
    if (!playerGame) throw new NotFoundError('Jugador no encontrado en la partida')
    return playerGame
  }
}
