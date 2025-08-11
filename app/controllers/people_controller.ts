import { HttpContext } from '@adonisjs/core/http'
import { PeopleService } from '../services/people.service.js'

// ...existing code...

export default class PeopleController {
  // GET /people
  public async index({ authUser, request, response }: HttpContext) {
    try {
      const userId = Number(authUser?.id)
      if (!userId) return response.status(401).json({ error: 'No autorizado' })

      const page = Number(request.input('page', 1))
      const limit = Number(request.input('limit', 10))

      const result = await PeopleService.getAllByUser(userId, page, limit)

      return response.json({
        data: result.all(),
        total: result.total,
        page: result.currentPage,
        pages: result.lastPage,
      })
    } catch (error) {
      return response.status(500).json({ error: 'Error al listar personas' })
    }
  }

  // GET /people/:id
  public async show({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser?.id)
      if (!userId) return response.status(401).json({ error: 'No autorizado' })

      const person = await PeopleService.findByIdForUser(Number(params.id), userId)
      if (!person) return response.status(404).json({ error: 'No encontrado' })

      return response.json(person)
    } catch {
      return response.status(500).json({ error: 'Error al obtener persona' })
    }
  }

  // POST /people
  public async store({ authUser, request, response }: HttpContext) {
    try {
      const userId = Number(authUser?.id)
      if (!userId) return response.status(401).json({ error: 'No autorizado' })

      const payload = request.only(['firstName', 'lastName', 'age', 'genre'])
      const person = await PeopleService.create(payload, userId)
      return response.status(201).json(person)
    } catch {
      return response.status(500).json({ error: 'Error al crear persona' })
    }
  }

  // PUT /people/:id
  public async update({ authUser, params, request, response }: HttpContext) {
    try {
      const userId = Number(authUser?.id)
      if (!userId) return response.status(401).json({ error: 'No autorizado' })

      const payload = request.only(['firstName', 'lastName', 'age', 'genre'])
      const updated = await PeopleService.update(Number(params.id), payload, userId)
      if (!updated) return response.status(404).json({ error: 'No encontrado' })

      return response.json(updated)
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        return response.status(403).json({ error: 'No puedes modificar esta persona' })
      }
      return response.status(500).json({ error: 'Error al actualizar persona' })
    }
  }

  // PATCH /people/:id/deactivate
  public async deactivate({ authUser, params, response }: HttpContext) {
    try {
      const userId = Number(authUser?.id)
      if (!userId) return response.status(401).json({ error: 'No autorizado' })

      const deleted = await PeopleService.softDelete(Number(params.id), userId)
      if (!deleted) return response.status(404).json({ error: 'No encontrado' })

      return response.json({ success: true })
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        return response.status(403).json({ error: 'No puedes eliminar esta persona' })
      }
      return response.status(500).json({ error: 'Error al eliminar persona' })
    }
  }

  // GET /people/statistics
  public async statistics({ authUser, response }: HttpContext) {
    try {
      const userId = Number(authUser?.id)
      if (!userId) return response.status(401).json({ error: 'No autorizado' })

      const stats = await PeopleService.getStatistics(userId)
      return response.json(stats)
    } catch {
      return response.status(500).json({ error: 'Error al obtener estadísticas' })
    }
  }
}
