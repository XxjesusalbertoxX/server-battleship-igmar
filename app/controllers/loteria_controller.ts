import { HttpContext } from '@adonisjs/core/http'
import { LoteriaService } from '#services/loteria.service'
import { schema, rules } from '@adonisjs/validator'

export default class LoteriaController {
  private loteriaService = new LoteriaService()

  // Generar carta de jugador
  async generateCard({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const result = await this.loteriaService.generatePlayerCard(gameId, userId)
      return response.ok(result)
    } catch (error) {
      console.error('Error al generar carta:', error)
      return response.badRequest({ message: error.message })
    }
  }

  // Sacar carta (solo anfitrión)
  async drawCard({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const result = await this.loteriaService.drawCard(gameId, userId)
      return response.ok(result)
    } catch (error) {
      console.error('Error al sacar carta:', error)
      return response.badRequest({ message: error.message })
    }
  }

  // Rebarajear cartas (solo anfitrión)
  async reshuffleCards({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const result = await this.loteriaService.reshuffleCards(gameId, userId)
      return response.ok(result)
    } catch (error) {
      console.error('Error al rebarajear:', error)
      return response.badRequest({ message: error.message })
    }
  }

  // Colocar ficha
  async placeToken({ authUser, params, request, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const validationSchema = schema.create({
        row: schema.number([rules.range(0, 3)]),
        col: schema.number([rules.range(0, 3)]),
      })

      const { row, col } = await request.validate({ schema: validationSchema })

      const result = await this.loteriaService.placeToken(gameId, userId, row, col)
      return response.ok(result)
    } catch (error) {
      console.error('Error al colocar ficha:', error)
      return response.badRequest({ message: error.message })
    }
  }

  // Reclamar victoria
  async claimWin({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const result = await this.loteriaService.claimWin(gameId, userId)
      return response.ok(result)
    } catch (error) {
      console.error('Error al reclamar victoria:', error)
      return response.badRequest({ message: error.message })
    }
  }

  // Expulsar jugador (solo anfitrión)
  async kickPlayer({ authUser, params, request, response }: HttpContext) {
    try {
      const hostUserId = Number(authUser.id)
      const gameId = params.id

      const validationSchema = schema.create({
        kickUserId: schema.number(),
      })

      const { kickUserId } = await request.validate({ schema: validationSchema })

      const result = await this.loteriaService.kickPlayer(gameId, hostUserId, kickUserId)
      return response.ok(result)
    } catch (error) {
      console.error('Error al expulsar jugador:', error)
      return response.badRequest({ message: error.message })
    }
  }

  // Procesar carta actual (limpiar para permitir siguiente)
  async processCard({ params, response }: HttpContext) {
    try {
      const gameId = params.id

      const result = await this.loteriaService.processCurrentCard(gameId)
      return response.ok(result)
    } catch (error) {
      console.error('Error al procesar carta:', error)
      return response.badRequest({ message: error.message })
    }
  }
}
