import { schema, rules } from '@adonisjs/validator'

export const PersonValidator = schema.create({
  firstName: schema.string({ trim: true }, [rules.minLength(2), rules.maxLength(50)]),
  lastName: schema.string({ trim: true }, [rules.minLength(2), rules.maxLength(50)]),
  age: schema.number.optional([rules.range(0, 150)]),
  genre: schema.enum(['male', 'female', 'other'] as const),
})
