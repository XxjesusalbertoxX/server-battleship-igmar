import Person from '#models/person'
import { LogService } from './log_services.js'

export interface StatisticsResult {
  gender: {
    male: number
    female: number
  }
  age: {
    adult: number
    minor: number
  }
  combined: {
    maleAdult: number
    maleMinor: number
    femaleAdult: number
    femaleMinor: number
  }
}

export interface CreatePersonData {
  firstName: string
  lastName: string
  age?: number
  genre: string
}

export interface UpdatePersonData {
  firstName?: string
  lastName?: string
  age?: number
  genre?: string
}

export class PeopleService {
  // Listar SOLO las personas del usuario
  static async getAllByUser(userId: number, page: number = 1, limit: number = 10) {
    return await Person.query()
      .where('is_active', true)
      .andWhere('user_id', userId)
      .paginate(page, limit)
  }

  // Buscar una persona que pertenezca al usuario
  static async findByIdForUser(id: number, userId: number) {
    return await Person.query().where('id', id).andWhere('user_id', userId).first()
  }

  static async create(data: CreatePersonData, userId: number) {
    const person = await Person.create({ ...data, userId, isActive: true })
    await LogService.log(
      userId,
      'create',
      'people',
      `Creó persona ${person.firstName} ${person.lastName}`,
      { person_id: person.id, data }
    )
    return person
  }

  static async update(id: number, data: UpdatePersonData, userId: number) {
    const person = await Person.find(id)
    if (!person) return null
    // Validar pertenencia
    if (person.userId !== userId) {
      // Opcional: lanzar error para controlar 403 en el controlador
      throw new Error('FORBIDDEN')
    }

    const oldData = {
      firstName: person.firstName,
      lastName: person.lastName,
      age: person.age,
      genre: person.genre,
    }

    person.merge(data)
    await person.save()

    await LogService.log(
      userId,
      'update',
      'people',
      `Actualizó persona ${person.firstName} ${person.lastName}`,
      {
        person_id: person.id,
        old_data: oldData,
        new_data: data,
      }
    )

    return person
  }

  static async softDelete(id: number, userId: number) {
    const person = await Person.find(id)
    if (!person) return null
    // Validar pertenencia
    if (person.userId !== userId) {
      throw new Error('FORBIDDEN')
    }

    person.isActive = false
    await person.save()

    await LogService.log(
      userId,
      'delete',
      'people',
      `Eliminó persona ${person.firstName} ${person.lastName}`,
      {
        person_id: person.id,
        deleted_person: {
          firstName: person.firstName,
          lastName: person.lastName,
          age: person.age,
          genre: person.genre,
        },
      }
    )

    return person
  }

  static async getStatistics(userId: number): Promise<StatisticsResult> {
    const people = await Person.query().where('is_active', true).andWhere('user_id', userId)

    // ...existing code...
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
      if (person.genre === 'male') male++
      else if (person.genre === 'female') female++
      if (isAdult) adult++
      else minor++
      if (person.genre === 'male' && isAdult) maleAdult++
      if (person.genre === 'male' && !isAdult) maleMinor++
      if (person.genre === 'female' && isAdult) femaleAdult++
      if (person.genre === 'female' && !isAdult) femaleMinor++
    }

    return {
      gender: { male, female },
      age: { adult, minor },
      combined: { maleAdult, maleMinor, femaleAdult, femaleMinor },
    }
  }
}
