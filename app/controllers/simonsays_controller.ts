import { HttpContext } from '@adonisjs/core/http'
import { schema, rules } from '@adonisjs/validator'
import { SimonSaysService } from '#services/simon_says.service'

export default class SimonsaysController {
  private simonSaysService = new SimonSaysService()

  public async setColors({ authUser, params, request, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const validationSchema = schema.create({
        colors: schema
          .array()
          .members(
            schema.string({}, [
              rules.minLength(1),
              rules.maxLength(20),
              rules.regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
            ])
          ),
      })

      const payload = await request.validate({ schema: validationSchema })
      const colors = payload.colors

      const result = await this.simonSaysService.setColors(gameId, userId, colors)
      return response.ok(result)
    } catch (error) {
      console.log(error)
      if (error.messages) {
        return response.badRequest({ errors: error.messages })
      }
      return response.badRequest({ message: error.message })
    }
  }

  public async chooseFirstColor({ authUser, params, request, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const validationSchema = schema.create({
        chosenColor: schema.string({}, [
          rules.minLength(1),
          rules.maxLength(20),
          rules.regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
        ]),
      })

      const payload = await request.validate({ schema: validationSchema })
      const chosenColor = payload.chosenColor

      const result = await this.simonSaysService.chooseFirstColor(gameId, userId, chosenColor)
      return response.ok(result)
    } catch (error) {
      console.log(error)
      if (error.messages) {
        return response.badRequest({ errors: error.messages })
      }
      return response.badRequest({ message: error.message })
    }
  }

  public async playColor({ authUser, params, request, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const validationSchema = schema.create({
        color: schema.string({}, [
          rules.minLength(4),
          rules.maxLength(7),
          rules.regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
        ]),
      })

      const payload = await request.validate({ schema: validationSchema })
      const color = payload.color

      const result = await this.simonSaysService.playColor(gameId, userId, color)
      return response.ok(result)
    } catch (error) {
      console.log(error)
      return response.badRequest({ message: error.message })
    }
  }

  public async chooseColor({ authUser, params, request, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const validationSchema = schema.create({
        chosenColor: schema.string({}, [
          rules.minLength(1),
          rules.maxLength(20),
          rules.regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
        ]),
      })

      const payload = await request.validate({ schema: validationSchema })
      const chosenColor = payload.chosenColor

      const result = await this.simonSaysService.chooseColor(gameId, userId, chosenColor)
      return response.ok(result)
    } catch (error) {
      console.log(error)
      if (error.messages) {
        return response.badRequest({ errors: error.messages })
      }
      return response.badRequest({ message: error.message })
    }
  }
}
