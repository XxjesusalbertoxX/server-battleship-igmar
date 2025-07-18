import { HttpContext } from '@adonisjs/core/http'
import { StatService } from '../services/stat.service.js'

export default class StatsController {
  private statService = new StatService()

  public async getBattleshipStats({ authUser, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      if (Number.isNaN(userId) || userId <= 0) {
        return response.badRequest({ message: 'Usuario inválido' })
      }

      const stats = await this.statService.getBattleshipStats(userId)
      return response.ok(stats)
    } catch (error) {
      return response.internalServerError({ message: error.message })
    }
  }

  public async getGameDetails({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      if (Number.isNaN(userId) || userId <= 0) {
        return response.badRequest({ message: 'Usuario inválido' })
      }

      // Validar que params.id existe y cumple con las reglas
      const gameId = params.id
      if (!gameId || gameId.length !== 24 || !/^[0-9a-fA-F]+$/.test(gameId)) {
        return response.badRequest({
          message: 'El campo id es requerido y debe ser un ObjectId válido',
        })
      }

      const details = await this.statService.getGameDetails(gameId, userId)
      return response.ok(details)
    } catch (error) {
      return response.internalServerError({ message: error.message })
    }
  }
}
