import { HttpContext } from '@adonisjs/core/http'
import { LoteriaService } from '../services/loteria.service.js'
import { schema, rules } from '@adonisjs/validator'

export default class LoteriaController {
  private loteriaService = new LoteriaService()

  // ========================================
  // MÉTODOS DE SELECCIÓN DE CARTAS
  // ========================================

  public async generateCard({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const result = await this.loteriaService.generatePlayerCard(gameId, userId)
      return response.ok(result)
    } catch (error) {
      console.error('Error al generar carta:', error)

      if (error.message === 'Juego no encontrado') {
        return response.notFound({ message: error.message })
      }

      if (error.message === 'No perteneces a esta partida') {
        return response.unauthorized({ message: error.message })
      }

      if (error.message === 'No se pueden generar cartas en este estado del juego') {
        return response.conflict({ message: error.message })
      }

      return response.internalServerError({ message: error.message })
    }
  }

  // ========================================
  // MÉTODOS DEL ANFITRIÓN
  // ========================================

  public async drawCard({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const result = await this.loteriaService.drawCard(gameId, userId)
      return response.ok(result)
    } catch (error) {
      console.error('Error al sacar carta:', error)

      if (error.message === 'Juego no encontrado') {
        return response.notFound({ message: error.message })
      }

      if (error.message === 'Solo el anfitrión puede sacar cartas') {
        return response.unauthorized({ message: error.message })
      }

      if (
        error.message === 'El juego no está en progreso' ||
        error.message === 'No hay cartas disponibles' ||
        error.message === 'Ya hay una carta activa, debe ser procesada primero'
      ) {
        return response.conflict({ message: error.message })
      }

      return response.internalServerError({ message: error.message })
    }
  }

  public async reshuffleCards({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const result = await this.loteriaService.reshuffleCards(gameId, userId)
      return response.ok(result)
    } catch (error) {
      console.error('Error al rebarajear cartas:', error)

      if (error.message === 'Juego no encontrado') {
        return response.notFound({ message: error.message })
      }

      if (error.message === 'Solo el anfitrión puede rebarajear') {
        return response.unauthorized({ message: error.message })
      }

      if (error.message === 'No hay cartas para rebarajear') {
        return response.conflict({ message: error.message })
      }

      return response.internalServerError({ message: error.message })
    }
  }

  public async processCard({ params, response }: HttpContext) {
    try {
      const gameId = params.id
      const result = await this.loteriaService.processCurrentCard(gameId)
      return response.ok(result)
    } catch (error) {
      console.error('Error al procesar carta:', error)
      return response.internalServerError({ message: error.message })
    }
  }

  // ========================================
  // MÉTODOS DE LOS JUGADORES
  // ========================================

  public async placeToken({ authUser, params, request, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const validationSchema = schema.create({
        cellIndex: schema.number([rules.range(0, 15)]),
      })

      const { cellIndex } = await request.validate({ schema: validationSchema })

      const result = await this.loteriaService.placeToken(gameId, userId, cellIndex)
      return response.ok(result)
    } catch (error) {
      console.error('Error al colocar ficha:', error)

      if (error.message === 'Juego no encontrado') {
        return response.notFound({ message: error.message })
      }

      if (error.message === 'No perteneces a esta partida') {
        return response.unauthorized({ message: error.message })
      }

      if (
        error.message === 'El juego no está en progreso' ||
        error.message === 'Estás en modo espectador y no puedes colocar fichas' ||
        error.message === 'Esta celda ya está marcada' ||
        error.message === 'La carta en esta posición no coincide con la carta actual'
      ) {
        return response.conflict({ message: error.message })
      }

      if (error.message === 'Índice de celda inválido (0-15)') {
        return response.badRequest({ message: error.message })
      }

      return response.internalServerError({ message: error.message })
    }
  }

  public async claimWin({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const result = await this.loteriaService.claimWin(gameId, userId)
      return response.ok(result)
    } catch (error) {
      console.error('Error al reclamar victoria:', error)

      if (error.message === 'Juego no encontrado') {
        return response.notFound({ message: error.message })
      }

      if (error.message === 'No perteneces a esta partida') {
        return response.unauthorized({ message: error.message })
      }

      if (
        error.message === 'El juego no está en progreso' ||
        error.message === 'Estás en modo espectador y no puedes reclamar victoria' ||
        error.message === 'No tienes la carta completa para reclamar victoria'
      ) {
        return response.conflict({ message: error.message })
      }

      return response.internalServerError({ message: error.message })
    }
  }
}
