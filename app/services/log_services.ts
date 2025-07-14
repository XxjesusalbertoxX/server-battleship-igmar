import { LogModel } from '#models/log'

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
}
