import { HttpContext } from '@adonisjs/core/http'
import { LoteriaService } from '../services/loteria.service.js'
import { schema, rules } from '@adonisjs/validator'

export default class LoteriaController {
  private loteriaService = new LoteriaService()

  // MÉTODOS DE SELECCIÓN DE CARTAS

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

  // MÉTODOS DEL ANFITRIÓN

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

  // MÉTODOS DE LOS JUGADORES

  public async placeToken({ authUser, params, request, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const validationSchema = schema.create({
        row: schema.number([rules.range(0, 3)]), // 0-3 para matriz 4x4
        col: schema.number([rules.range(0, 3)]), // 0-3 para matriz 4x4
      })

      const { row, col } = await request.validate({ schema: validationSchema })

      const result = await this.loteriaService.placeToken(gameId, userId, row, col)
      return response.ok(result)
    } catch (error) {
      console.error('Error al colocar ficha:', error)

      if (error.message === 'Juego no encontrado') {
        return response.notFound({ message: error.message })
      }

      if (
        error.message === 'El juego no está en progreso' ||
        error.message === 'No perteneces a esta partida' ||
        error.message === 'El anfitrión no puede colocar fichas' ||
        error.message === 'Estás en modo espectador y no puedes colocar fichas' ||
        error.message === 'Esta celda ya está marcada'
      ) {
        return response.conflict({ message: error.message })
      }

      if (error.message === 'Coordenadas inválidas (0-3 para fila y columna)') {
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

  public async kickPlayer({ authUser, params, request, response }: HttpContext) {
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

      if (error.message === 'Juego no encontrado') {
        return response.notFound({ message: error.message })
      }

      if (
        error.message === 'Solo el anfitrión puede expulsar jugadores' ||
        error.message === 'Jugador no encontrado o no se puede expulsar'
      ) {
        return response.unauthorized({ message: error.message })
      }

      if (error.message === 'Solo se puede expulsar jugadores en el lobby') {
        return response.conflict({ message: error.message })
      }

      return response.internalServerError({ message: error.message })
    }
  }
}
