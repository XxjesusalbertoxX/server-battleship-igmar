import { HttpContext } from '@adonisjs/core/http'
import Person from '../models/person.js'
import { validator } from '@adonisjs/validator'
import { PersonValidator } from '../validators/person.js'
import { LogService } from '../services/log_services.js'

export default class PeopleController {
  public async index({ request, response }: HttpContext) {
    const page = Number(request.input('page', 1))
    const limit = Number(request.input('limit', 10))
    const result = await Person.query().where('is_active', true).paginate(page, limit)
    return response.ok(result)
  }

  public async store({ authUser, request, response }: HttpContext) {
    try {
      const data = await validator.validate({
        schema: PersonValidator,
        data: request.only(['firstName', 'lastName', 'age', 'genre']),
      })

      const person = await Person.create({ ...data, userId: Number(authUser.id) })

      // Log de creación
      await LogService.log(
        Number(authUser.id),
        'create',
        'people',
        `Creó persona ${person.firstName} ${person.lastName}`,
        { person_id: person.id }
      )

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
    const person = await Person.find(params.id)
    if (!person) {
      return response.notFound({ message: 'Person not found' })
    }
    return response.ok(person)
  }

  public async update({ authUser, params, request, response }: HttpContext) {
    try {
      const data = await validator.validate({
        schema: PersonValidator,
        data: request.only(['firstName', 'lastName', 'age', 'genre']),
      })

      const person = await Person.find(params.id)
      if (!person) {
        return response.notFound({ message: 'Person not found' })
      }

      person.merge(data)
      await person.save()

      // Log de actualización
      await LogService.log(
        Number(authUser.id),
        'update',
        'people',
        `Actualizó persona ${person.id}`,
        { person_id: person.id }
      )

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
    const person = await Person.find(params.id)
    if (!person) {
      return response.notFound({ message: 'Persona no encontrada' })
    }

    person.isActive = false
    await person.save()

    // Log de eliminación (soft delete)
    await LogService.log(
      Number(authUser.id),
      'delete',
      'people',
      `Eliminó persona con ID ${person.id}`,
      { person_id: person.id }
    )
  }

  public async statistics({ response }: HttpContext) {
    const people = await Person.query().where('is_active', true)

    // Inicializar contadores
    let male = 0
    let female = 0
    let adult = 0
    let minor = 0

    let maleAdult = 0
    let maleMinor = 0
    let femaleAdult = 0
    let femaleMinor = 0

    for (const person of people) {
      const isAdult = (person.age ?? 0) >= 18

      // Contador por género
      if (person.genre === 'male') male++
      else if (person.genre === 'female') female++

      // Contador por edad
      if (isAdult) adult++
      else minor++

      // Combinado
      if (person.genre === 'male' && isAdult) maleAdult++
      if (person.genre === 'male' && !isAdult) maleMinor++
      if (person.genre === 'female' && isAdult) femaleAdult++
      if (person.genre === 'female' && !isAdult) femaleMinor++
    }

    return response.ok({
      gender: {
        male,
        female,
      },
      age: {
        adult,
        minor,
      },
      combined: {
        maleAdult,
        maleMinor,
        femaleAdult,
        femaleMinor,
      },
    })
  }
}
