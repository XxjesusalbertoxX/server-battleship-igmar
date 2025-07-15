import { HttpContext } from '@adonisjs/core/http'
import { StatService } from '../services/stat.service.js'
import { schema, rules } from '@adonisjs/validator'

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

  public async getGameDetails({ authUser, params, request, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      if (Number.isNaN(userId) || userId <= 0) {
        return response.badRequest({ message: 'Usuario inválido' })
      }

      // Validar que gameId existe y es string no vacío
      const validationSchema = schema.create({
        id: schema.string({}, [
          rules.minLength(24),
          rules.maxLength(24), // ObjectId length
          rules.regex(/^[0-9a-fA-F]+$/),
        ]),
      })

      await request.validate({ schema: validationSchema })

      const gameId = params.id
      const details = await this.statService.getGameDetails(gameId, userId)
      return response.ok(details)
    } catch (error) {
      if (error.messages) {
        return response.badRequest({ errors: error.messages })
      }
      return response.notFound({ message: error.message })
    }
  }
}
