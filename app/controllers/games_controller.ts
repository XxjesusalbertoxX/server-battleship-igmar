import { HttpContext } from '@adonisjs/core/http'
import GameService from '../services/game.service.js'
import PlayerGameService from '../services/player_game.service.js'
import { schema, rules } from '@adonisjs/validator'
import { v4 as uuidv4 } from 'uuid'

export default class GameController {
  private gameService = new GameService()
  private playerGameService = new PlayerGameService()

  // Muestra la información de una partida si el usuario pertenece a ella
  public async showGame({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const playerGame = await this.playerGameService.findPlayerInGame(userId, gameId)
      if (!playerGame) {
        return response.unauthorized({ message: 'No puedes ver esta partida' })
      }

      const game = await this.gameService.getGameWithPlayers(gameId)
      return response.ok({
        gameId: game.id,
        player: game.players.find((p: any) => p.userId === userId)?.user || null,
        code: game.code,
        players: game.players,
      })
    } catch (error) {
      return response.internalServerError({ message: error.message })
    }
  }

  // Crear partida e invitar jugadores
  public async createGame({ authUser, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const createdGame = await this.gameService.createGame({
        userIds: [userId],
        gameTypeId: 1,
        code: uuidv4().substring(0, 8).toUpperCase(),
      })

      return response.created({ id: createdGame.id, code: createdGame.code })
    } catch (error) {
      console.error('Error en createGame:', error) // <<< imprime stack completo
      return response.internalServerError({ message: error.message })
    }
  }

  // Unirse a una partida existente mediante código
  public async joinGame({ authUser, request, response }: HttpContext) {
    try {
      const validationSchema = schema.create({
        code: schema.string({}, [rules.minLength(8), rules.maxLength(8), rules.alphaNum()]),
      })
      const payload = await request.validate({ schema: validationSchema })
      const { code } = payload
      const userId = Number(authUser.id)

      const game = await this.gameService.joinGame(userId, code)
      return response.ok({ gameId: game._id || game.id })
    } catch (error) {
      if (error.message.includes('Partida no encontrada')) {
        return response.notFound({ error: error.message })
      }
      if (error.message.includes('ya tiene 2 jugadores')) {
        return response.conflict({ error: error.message })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  // Marcar jugador listo para iniciar partida
  public async setReady({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const allReady = await this.playerGameService.setReady(userId, gameId)

      // Si todos están listos, actualizar estado del juego
      if (allReady) {
        await this.gameService.updateStatusToStarted(gameId)
      }

      return response.ok({ message: 'Listo' })
    } catch (error) {
      return response.notFound({ message: error.message })
    }
  }

  // Consultar estado general de la partida
  public async lobbyStatus({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const status = await this.gameService.getLobbyStatus(gameId, userId)
      return response.ok(status)
    } catch (error) {
      return response.notFound({ message: error.message })
    }
  }

  public async gameStatus({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const status = await this.gameService.getGameStatus(gameId, userId)
      return response.ok(status)
    } catch (error) {
      return response.notFound({ message: error.message })
    }
  }

  // Acción genérica para manejar distintos tipos de acciones (ataque, rendirse, etc)
  // public async action({ authUser, request, params, response }: HttpContext) {
  //   try {
  //     const userId = Number(authUser.id)
  //     const gameId = params.id
  //     const actionType = request.input('actionType')

  //     switch (actionType) {
  //       case 'attack': {
  //         const x = Number(request.input('row'))
  //         const y = Number(request.input('col'))

  //         if (Number.isNaN(x) || Number.isNaN(y)) {
  //           return response.unprocessableEntity({ error: 'Faltan coordenadas' })
  //         }

  //         const result = await this.gameService.attack(userId, gameId, x, y)
  //         return response.ok(result)
  //       }

  //       case 'surrender': {
  //         const result = await this.playerGameService.surrender(userId, gameId)
  //         return response.ok(result)
  //       }

  //       default:
  //         return response.badRequest({ error: 'Acción no válida' })
  //     }
  //   } catch (error) {
  //     return response.internalServerError({ message: error.message })
  //   }
  // }
}
