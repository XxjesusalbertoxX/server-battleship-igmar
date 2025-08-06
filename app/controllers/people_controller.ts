import { HttpContext } from '@adonisjs/core/http'
import { validator } from '@adonisjs/validator'
import { PersonValidator } from '../validators/person.js'
import { PeopleService } from '../services/people.service.js'

export default class PeopleController {
  public async index({ request, response }: HttpContext) {
    try {
      const page = Number(request.input('page', 1))
      const limit = Number(request.input('limit', 10))

      const result = await PeopleService.getAll(page, limit)
      return response.ok(result)
    } catch (error) {
      console.error('❌ Error al obtener personas:', error)
      return response.internalServerError({ message: 'Error interno del servidor' })
    }
  }

  public async store({ authUser, request, response }: HttpContext) {
    try {
      const data = await validator.validate({
        schema: PersonValidator,
        data: request.only(['firstName', 'lastName', 'age', 'genre']),
      })

      const person = await PeopleService.create(data, Number(authUser.id))
      return response.created(person)
    } catch (error) {
      console.error('❌ Error en creación de persona:', error)
      return response.unprocessableEntity({
        message: 'Validation failed',
        errors: error.messages || error.message,
      })
    }
  }

  public async show({ params, response }: HttpContext) {
    try {
      const person = await PeopleService.findById(params.id)
      if (!person) {
        return response.notFound({ message: 'Person not found' })
      }
      return response.ok(person)
    } catch (error) {
      console.error('❌ Error al obtener persona:', error)
      return response.internalServerError({ message: 'Error interno del servidor' })
    }
  }

  public async update({ authUser, params, request, response }: HttpContext) {
    try {
      const data = await validator.validate({
        schema: PersonValidator,
        data: request.only(['firstName', 'lastName', 'age', 'genre']),
      })

      const person = await PeopleService.update(params.id, data, Number(authUser.id))
      if (!person) {
        return response.notFound({ message: 'Person not found' })
      }

      return response.ok(person)
    } catch (error) {
      console.error('❌ Error en actualización de persona:', error)
      return response.unprocessableEntity({
        message: 'Validation failed',
        errors: error.messages || error.message,
      })
    }
  }

  public async softDelete({ authUser, params, response }: HttpContext) {
    try {
      const person = await PeopleService.softDelete(params.id, Number(authUser.id))
      if (!person) {
        return response.notFound({ message: 'Persona no encontrada' })
      }

      return response.ok({ message: 'Persona eliminada correctamente' })
    } catch (error) {
      console.error('❌ Error al eliminar persona:', error)
      return response.internalServerError({ message: 'Error interno del servidor' })
    }
  }

  public async statistics({ response }: HttpContext) {
    try {
      const statistics = await PeopleService.getStatistics()
      return response.ok(statistics)
    } catch (error) {
      console.error('❌ Error al obtener estadísticas:', error)
      return response.internalServerError({ message: 'Error interno del servidor' })
    }
  }
}
