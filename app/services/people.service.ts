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
  static async getAll(page: number = 1, limit: number = 10) {
    return await Person.query().where('is_active', true).paginate(page, limit)
  }

  static async findById(id: number) {
    return await Person.find(id)
  }

  static async create(data: CreatePersonData, userId: number) {
    const person = await Person.create({ ...data, userId, isActive: true })

    // Log de creación
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
    if (!person) {
      return null
    }

    const oldData = {
      firstName: person.firstName,
      lastName: person.lastName,
      age: person.age,
      genre: person.genre,
    }

    person.merge(data)
    await person.save()

    // Log de actualización
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
    if (!person) {
      return null
    }

    person.isActive = false
    await person.save()

    // Log de eliminación
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

  static async getStatistics(): Promise<StatisticsResult> {
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

    return {
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
    }
  }
}
