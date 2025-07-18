import { HttpContext } from '@adonisjs/core/http'
import { schema, rules } from '@adonisjs/validator'
import { SimonSaysService } from '#services/simon_says.service'

export default class SimonsaysController {
  private simonSaysService = new SimonSaysService()

  // Establecer colores personalizados
  public async setColors({ authUser, params, request, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      // Validar input
      const validationSchema = schema.create({
        colors: schema.array().members(
          schema.string({}, [
            rules.minLength(1),
            rules.maxLength(20),
            rules.regex(/^[a-zA-Z0-9#]+$/), // colores hex o nombres alfanuméricos
          ])
        ),
      })

      const payload = await request.validate({ schema: validationSchema })
      const colors = payload.colors

      const result = await this.simonSaysService.setColors(gameId, userId, colors)
      return response.ok(result)
    } catch (error) {
      // Mejor manejo de errores
      if (error.messages) {
        // Errores de validación
        return response.badRequest({ errors: error.messages })
      }
      return response.badRequest({ message: error.message })
    }
  }

  // Turno de Simon Says (playMove)
  public async play({ authUser, params, request, response }: HttpContext) {
    try {
      const userId = Number(authUser.id)
      const gameId = params.id

      // Validar input
      const validationSchema = schema.create({
        chosenColor: schema.string({}, [
          rules.minLength(1),
          rules.maxLength(20),
          rules.regex(/^[a-zA-Z0-9#]+$/),
        ]),
      })

      const payload = await request.validate({ schema: validationSchema })
      const chosenColor = payload.chosenColor

      const result = await this.simonSaysService.playMove(gameId, userId, chosenColor)
      return response.ok(result)
    } catch (error) {
      if (error.messages) {
        return response.badRequest({ errors: error.messages })
      }
      return response.badRequest({ message: error.message })
    }
  }
}
