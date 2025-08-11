import { HttpContext } from '@adonisjs/core/http'
import { schema, rules } from '@adonisjs/validator'
import { SimonSaysService } from '#services/simon_says.service'

export default class SimonsaysController {
  private simonSaysService = new SimonSaysService()

  // Endpoint para escoger color (primer color o siguiente)
  public async chooseColor({ authUser, params, request, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      const validationSchema = schema.create({
        chosenColor: schema.string({}, [
          rules.minLength(4),
          rules.maxLength(7),
          rules.regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
        ]),
      })

      const payload = await request.validate({ schema: validationSchema })
      const chosenColor = payload.chosenColor

      const result = await this.simonSaysService.chooseColor(gameId, userId, chosenColor)
      return response.ok(result)
    } catch (error) {
      console.log(error)
      return response.badRequest({ message: error.message })
    }
  }

  // Endpoint para repetir color de la secuencia
  public async repeatColor({ authUser, params, request, response }: HttpContext) {
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

      const result = await this.simonSaysService.repeatSequenceColor(gameId, userId, color)
      return response.ok(result)
    } catch (error) {
      console.log(error)
      return response.badRequest({ message: error.message })
    }
  }
}
