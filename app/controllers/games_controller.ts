import { HttpContext } from '@adonisjs/core/http'
import GameService from '../services/game.service.js'
import PlayerGameService from '#services/player_game.service'
import { schema, rules } from '@adonisjs/validator'
import { v4 as uuidv4 } from 'uuid'

export default class GameController {
  private gameService = new GameService()
  private playerGameService = new PlayerGameService()

  // Crear nueva partida
  public async createGame({ authUser, params, response, request }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      let createGameParams: any = {
        userIds: [userId],
        gameType: params.gameType,
        code: uuidv4().substring(0, 8).toUpperCase(),
      }

      if (params.gameType === 'loteria') {
        const { minPlayers, maxPlayers, drawCooldownSeconds } = request.body()
        if (!minPlayers || !maxPlayers) {
          return response.badRequest({
            message: 'minPlayers y maxPlayers son requeridos para lotería',
          })
        }
        createGameParams.minPlayers = minPlayers
        createGameParams.maxPlayers = maxPlayers
        createGameParams.drawCooldownSeconds = drawCooldownSeconds || 2 // Valor por defecto
      }

      // AGREGAR: Para Simon Says, extraer customColors
      if (params.gameType === 'simonsay') {
        const { customColors } = request.body()
        if (customColors) {
          createGameParams.customColors = customColors
        }
      }

      const createdGame = await this.gameService.createGame(createGameParams)
      return response.created({ gameId: createdGame.id, code: createdGame.code })
    } catch (error) {
      return response.internalServerError({ message: error.message })
    }
  }

  // Unirse a una partida existente
  public async joinGame({ authUser, request, response }: HttpContext) {
    try {
      const validationSchema = schema.create({
        code: schema.string({}, [rules.minLength(8), rules.maxLength(8), rules.alphaNum()]),
      })

      const { code } = await request.validate({ schema: validationSchema })
      const userId = Number(authUser.id)

      // Buscar partida por código
      const game = await this.gameService.findByCode(code)
      if (!game) {
        return response.notFound({ error: 'Partida no encontrada' })
      }

      if (game.status === 'finished') {
        return response.conflict({ error: 'La partida ya finalizó' })
      }

      // Validar que el usuario no esté ya en la partida
      const alreadyJoined = await this.playerGameService.playerExistsInGame(userId, game._id)
      if (alreadyJoined) {
        return response.conflict({ error: 'Ya estás en esta partida' })
      }

      // Validación según tipo de juego
      if (game.gameType === 'loteria') {
        // Para lotería, validar máximo de jugadores
        // maxPlayers está en el modelo de lotería, así que haz un cast seguro
        const maxPlayers = (game as any).maxPlayers ?? 16
        if (game.players.length >= maxPlayers) {
          return response.conflict({
            error: `La partida ya tiene el máximo de ${maxPlayers} jugadores`,
          })
        }
      } else {
        if (game.players.length >= 2) {
          return response.conflict({ error: 'La partida ya tiene 2 jugadores' })
        }
      }

      // Unir al jugador
      await this.gameService.joinGame(userId, code)

      return response.ok({ gameId: game._id.toString() })
    } catch (error) {
      console.error(error)
      return response.internalServerError({ message: error.message })
    }
  }

  public async setReady({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const game = await this.gameService.findById(gameId)
      if (!game) {
        return response.notFound({ message: 'Partida no encontrada' })
      }

      if (game.status === 'finished') {
        return response.conflict({ message: 'La partida ya finalizó' })
      }

      const playerGame = await this.playerGameService.findPlayerInGame(userId, gameId)
      if (!playerGame) {
        return response.unauthorized({ message: 'No perteneces a esta partida' })
      }

      // Para lotería, el anfitrión NO puede marcarse como ready
      if (game.gameType === 'loteria' && (playerGame as any).isHost) {
        return response.conflict({ message: 'El anfitrión no puede marcarse como listo' })
      }

      if (playerGame.ready) {
        return response.conflict({ message: 'Ya habías marcado listo' })
      }

      await this.playerGameService.setReady(userId, gameId)

      return response.ok({ message: 'Listo' })
    } catch (error) {
      console.error('Error al marcar listo:', error)
      return response.internalServerError({ message: error.message })
    }
  }

  // Cambiar estado a 'started'
  public async updateStatusToStarted({ params, response }: HttpContext) {
    try {
      const gameId = params.id
      await this.gameService.updateStatusToStarted(gameId)
      return response.ok({ message: 'Status updated to started' })
    } catch (error) {
      return response.notFound({ message: error.message })
    }
  }

  // Iniciar partida (start)
  public async start({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id
      const game = await this.gameService.findById(gameId)
      if (!game) {
        return response.notFound({ message: 'Juego no encontrado' })
      }
      const result = await this.gameService.startGame(gameId, userId)
      return response.ok(result)
    } catch (error) {
      console.error('Error al iniciar el juego:', error)
      if (error.message === 'No todos los jugadores están listos') {
        return response.conflict({ message: error.message })
      }
      if (error.message === 'No perteneces a esta partida') {
        return response.unauthorized({ message: error.message })
      }
      return response.badRequest({ message: error.message })
    }
  }

  // Polling en el lobby
  public async lobbyStatus({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const status = await this.gameService.getLobbyStatus(gameId, userId)
      return response.ok(status)
    } catch (error) {
      if (error.message === 'No perteneces a esta partida') {
        return response.unauthorized({ message: error.message })
      }

      if (error.message === 'Partida no encontrada') {
        return response.notFound({ message: error.message })
      }

      return response.badRequest({ message: error.message })
    }
  }

  // Polling estado del juego en progreso
  public async gameStatus({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const status = await this.gameService.getGameStatus(gameId, userId)
      return response.ok(status)
    } catch (error) {
      console.error('Error al obtener el estado del juego:', error)
      if (error.message === 'No perteneces a esta partida') {
        return response.unauthorized({ message: error.message })
      }

      if (
        error.message === 'Juego no encontrado' ||
        error.message === 'La partida no tiene jugadores'
      ) {
        return response.notFound({ message: error.message })
      }

      if (
        error.message === 'La partida no ha comenzado' ||
        error.message === 'Tipo de juego no soportado'
      ) {
        return response.badRequest({ message: error.message })
      }

      return response.internalServerError({ message: error.message })
    }
  }

  public async leaveGame({ authUser, params, response }: HttpContext) {
    try {
      const gameId = params.id
      const userId = Number(authUser.id)

      if (!userId) {
        return response.unauthorized({ message: 'No estás autenticado' })
      }

      const result = await this.gameService.leaveGame(gameId, userId)
      return response.ok(result)
    } catch (error) {
      if (error.message === 'No perteneces a esta partida') {
        return response.unauthorized({ message: error.message })
      }
      console.error('Error al salir del juego:', error)
      return response.badRequest({ message: error.message })
    }
  }

  public async heartbeat({ params, response }: HttpContext) {
    try {
      const gameId = params.id
      const result = await this.gameService.heartbeat(gameId)
      return response.ok(result)
    } catch (error) {
      return response.internalServerError({ message: error.message })
    }
  }
}
