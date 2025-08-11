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

      // VALIDACIONES MEJORADAS
      const validationErrors = this.validatePersonData(payload)
      if (validationErrors.length > 0) {
        return response.status(400).json({
          error: 'Datos inválidos',
          details: validationErrors,
        })
      }

      const person = await PeopleService.create(payload, userId)
      return response.status(201).json(person)
    } catch (error) {
      console.error('Error creating person:', error)
      return response.status(500).json({ error: 'Error al crear persona' })
    }
  }

  // PUT /people/:id
  public async update({ authUser, params, request, response }: HttpContext) {
    try {
      const userId = Number(authUser?.id)
      if (!userId) return response.status(401).json({ error: 'No autorizado' })

      const payload = request.only(['firstName', 'lastName', 'age', 'genre'])

      // VALIDACIONES MEJORADAS
      const validationErrors = this.validatePersonData(payload)
      if (validationErrors.length > 0) {
        return response.status(400).json({
          error: 'Datos inválidos',
          details: validationErrors,
        })
      }

      const updated = await PeopleService.update(Number(params.id), payload, userId)
      if (!updated) return response.status(404).json({ error: 'No encontrado' })

      return response.json(updated)
    } catch (error: any) {
      if (error.message === 'FORBIDDEN') {
        return response.status(403).json({ error: 'No puedes modificar esta persona' })
      }
      console.error('Error updating person:', error)
      return response.status(500).json({ error: 'Error al actualizar persona' })
    }
  }

  // NUEVO: Método de validación
  private validatePersonData(data: any): string[] {
    const errors: string[] = []

    // Validar firstName
    if (!data.firstName || typeof data.firstName !== 'string') {
      errors.push('El nombre es requerido')
    } else if (data.firstName.trim().length < 2) {
      errors.push('El nombre debe tener al menos 2 caracteres')
    } else if (data.firstName.trim().length > 50) {
      errors.push('El nombre no puede exceder 50 caracteres')
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(data.firstName.trim())) {
      errors.push('El nombre solo puede contener letras y espacios')
    }

    // Validar lastName
    if (!data.lastName || typeof data.lastName !== 'string') {
      errors.push('El apellido es requerido')
    } else if (data.lastName.trim().length < 2) {
      errors.push('El apellido debe tener al menos 2 caracteres')
    } else if (data.lastName.trim().length > 50) {
      errors.push('El apellido no puede exceder 50 caracteres')
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(data.lastName.trim())) {
      errors.push('El apellido solo puede contener letras y espacios')
    }

    // Validar age
    if (!data.age || typeof data.age !== 'number') {
      errors.push('La edad es requerida')
    } else {
      const age = Number(data.age)
      if (Number.isNaN(age)) {
        errors.push('La edad debe ser un número válido')
      } else if (age < 4) {
        errors.push('La edad mínima es 4 años')
      } else if (age > 105) {
        errors.push('La edad máxima es 105 años')
      }
    }

    // Validar genre (sin 'other')
    if (!data.genre || typeof data.genre !== 'string') {
      errors.push('El género es requerido')
    } else if (!['male', 'female'].includes(data.genre)) {
      errors.push('El género debe ser "male" o "female"')
    }

    return errors
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
