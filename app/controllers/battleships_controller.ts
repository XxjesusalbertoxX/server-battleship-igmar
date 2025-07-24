import { HttpContext } from '@adonisjs/core/http'
import { BattleshipService } from '../services/battleship.service.js'

export default class BattleshipsController {
  private battleshipService = new BattleshipService()

  // Ataque en Battleship
  public async attack({ authUser, params, response }: HttpContext) {
    // console.log('parametros:', params)
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      // Validar params.row y params.col
      const row = Number(params.y) // y = fila
      const col = Number(params.x) // x = columna

      if (Number.isNaN(row) || Number.isNaN(col) || row < 0 || row > 7 || col < 0 || col > 7) {
        return response.badRequest({ message: 'Fila o columna inválida' })
      }

      const result = await this.battleshipService.attack(userId, gameId, row, col)
      return response.ok(result)
    } catch (error) {
      return response.badRequest({ message: error.message })
    }
  }

  // Agregar este método al BattleshipsController existente
  public async surrender({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      // Llamamos al servicio que ya creaste para renderirse
      const result = await this.battleshipService.surrenderGame(gameId, userId)

      return response.ok({
        ...result,
        message: 'Te has rendido. La victoria ha sido otorgada a tu oponente.',
      })
    } catch (error) {
      if (error.message === 'Juego no encontrado') {
        return response.notFound({ message: error.message })
      }
      if (error.message === 'La partida ya terminó') {
        return response.conflict({ message: error.message })
      }
      if (error.message === 'Jugadores no encontrados') {
        return response.notFound({ message: error.message })
      }

      return response.internalServerError({ message: error.message })
    }
  }
}
