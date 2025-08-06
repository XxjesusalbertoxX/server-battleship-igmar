import { HttpContext } from '@adonisjs/core/http'
import { LogService } from '../services/log_services.js'

export default class LogsController {
  public async index({ request, response }: HttpContext) {
    try {
      const page = Number(request.input('page', 1))
      const limit = Number(request.input('limit', 10))

      const result = await LogService.getLogs(page, limit)
      return response.ok(result)
    } catch (error) {
      console.error('❌ Error al obtener logs:', error)
      return response.internalServerError({ message: 'Error interno del servidor' })
    }
  }

  public async getByUser({ request, response }: HttpContext) {
    try {
      const userId = Number(request.param('userId'))
      const page = Number(request.input('page', 1))
      const limit = Number(request.input('limit', 10))

      const logs = await LogService.getLogsByUser(userId, page, limit)
      return response.ok(logs)
    } catch (error) {
      console.error('❌ Error al obtener logs por usuario:', error)
      return response.internalServerError({ message: 'Error interno del servidor' })
    }
  }

  public async getByTable({ request, response }: HttpContext) {
    try {
      const table = request.param('table')
      const page = Number(request.input('page', 1))
      const limit = Number(request.input('limit', 10))

      const logs = await LogService.getLogsByTable(table, page, limit)
      return response.ok(logs)
    } catch (error) {
      console.error('❌ Error al obtener logs por tabla:', error)
      return response.internalServerError({ message: 'Error interno del servidor' })
    }
  }
}
