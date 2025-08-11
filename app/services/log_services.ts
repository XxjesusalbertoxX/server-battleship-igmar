import { LogModel } from '#models/log'
import User from '#models/user'

export interface LogWithUser {
  id: string
  user_id: number
  user_name: string
  action: string
  table: string
  description?: string
  metadata?: any
  timestamp: Date
}

export interface LogsResponse {
  data: LogWithUser[]
  total: number
  page: number
  perPage: number
  lastPage: number
}

export class LogService {
  static async log(
    userId: number,
    action: string,
    table: string,
    description?: string,
    metadata?: any
  ) {
    try {
      await LogModel.create({
        user_id: userId,
        action,
        table,
        description,
        metadata,
        timestamp: new Date(),
      })
    } catch (error) {
      console.error('[LogService] Error al guardar log:', error)
    }
  }

  // Obtener logs con paginación; si se pasa userId, filtra por ese usuario
  static async getLogs(
    page: number = 1,
    limit: number = 10,
    userId?: number
  ): Promise<LogsResponse> {
    try {
      const skip = (page - 1) * limit

      // Filtro opcional por usuario
      const filter: Record<string, any> = {}
      if (typeof userId === 'number') {
        filter.user_id = userId
      }

      // Obtener total de documentos
      const total = await LogModel.countDocuments(filter)

      // Obtener logs paginados
      const logs = await LogModel.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean()

      // Obtener información de usuarios
      const userIds = [...new Set(logs.map((log) => log.user_id))]
      const users = userIds.length > 0 ? await User.query().whereIn('id', userIds) : []
      const userMap = new Map(users.map((user) => [user.id, user.name]))

      const data = logs.map((log) => ({
        id: log._id.toString(),
        user_id: log.user_id,
        user_name: userMap.get(log.user_id) || 'Usuario desconocido',
        action: log.action,
        table: log.table,
        description: log.description,
        metadata: log.metadata,
        timestamp: log.timestamp,
      }))

      const lastPage = Math.ceil(total / limit)

      return {
        data,
        total,
        page,
        perPage: limit,
        lastPage,
      }
    } catch (error) {
      console.error('[LogService] Error al obtener logs:', error)
      return {
        data: [],
        total: 0,
        page: 1,
        perPage: limit,
        lastPage: 1,
      }
    }
  }

  static async getLogsByUser(userId: number, page: number = 1, limit: number = 10) {
    try {
      return await LogModel.find({ user_id: userId })
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    } catch (error) {
      console.error('[LogService] Error al obtener logs por usuario:', error)
      return []
    }
  }

  static async getLogsByTable(table: string, page: number = 1, limit: number = 10) {
    try {
      return await LogModel.find({ table })
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    } catch (error) {
      console.error('[LogService] Error al obtener logs por tabla:', error)
      return []
    }
  }
}
