import { HttpContext } from '@adonisjs/core/http'
import GameService from '../services/game.service.js'

export default class BattleshipsController {
  private gameService = new GameService()

  // Ataque en Battleship
  public async attack({ authUser, params, response }: HttpContext) {
    // console.log('parametros:', params)
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      // Validar params.row y params.col
      const row = Number(params.x)
      const col = Number(params.y)

      if (Number.isNaN(row) || Number.isNaN(col) || row < 0 || row > 7 || col < 0 || col > 7) {
        return response.badRequest({ message: 'Fila o columna inválida' })
      }

      const result = await this.gameService.attack(userId, gameId, row, col)
      return response.ok(result)
    } catch (error) {
      return response.badRequest({ message: error.message })
    }
  }
}
