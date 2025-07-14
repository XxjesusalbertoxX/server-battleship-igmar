import type { HttpContext } from '@adonisjs/core/http'
import GameService from '../services/game.service.js'
import PlayerGameService from '../services/player_game.service.js'

export default class BattleshipsController {
  private playerGameService = new PlayerGameService()
  private gameService = new GameService()

  public async startGame({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const result = await this.gameService.startGame(gameId, userId)

      return response.ok(result)
    } catch (error) {
      console.error('Error iniciando partida:', error)
      return response.internalServerError({ message: error.message })
    }
  }

  // Atacka y regresa si fue hit o miss
  public async attack({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id
      const x = Number(params.x)
      const y = Number(params.y)

      if (Number.isNaN(x) || Number.isNaN(y) || x < 0 || x > 7 || y < 0 || y > 7) {
        return response.unprocessableEntity({ error: 'Coordenadas inválidas' })
      }

      // Buscar el playerGame del usuario en esa partida
      const playerGame = await this.playerGameService.findPlayerInGame(userId, gameId)
      if (!playerGame) {
        return response.unauthorized({ error: 'No perteneces a esta partida' })
      }

      // Ejecutar el ataque
      const result = await this.gameService.attack(userId, gameId, x, y)

      return response.ok(result)
    } catch (error) {
      if (error.message.includes('turno')) {
        return response.unauthorized({ error: error.message })
      }
      if (error.message.includes('Casilla ya atacada')) {
        return response.unprocessableEntity({ error: error.message })
      }
      return response.internalServerError({ message: error.message })
    }
  }

  // Actualizar el último "heartbeat" para saber si jugador está activo
  public async heartbeat({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const result = await this.playerGameService.heartbeat(userId, gameId)
      return response.ok(result)
    } catch (error) {
      return response.notFound({ message: error.message })
    }
  }

  // Rendirse y abandonar la partida
  public async surrender({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const result = await this.playerGameService.surrender(userId, gameId)
      return response.ok(result)
    } catch (error) {
      return response.notFound({ message: error.message })
    }
  }
}
