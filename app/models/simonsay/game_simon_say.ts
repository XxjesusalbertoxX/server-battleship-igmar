import mongoose, { Schema, Model } from 'mongoose'
import { BaseModel } from '../base_model.js'
import { GameBaseDoc, GameBaseCreateInput, GameBaseModel } from '../game_base.js'

export interface GameSimonSayDoc extends Omit<GameBaseDoc, 'status'> {
  gameType: 'simonsay'
  status:
    | 'waiting'
    | 'started'
    | 'choosing_first_color'
    | 'repeating_sequence'
    | 'choosing_next_color'
    | 'finished'
  // Secuencia global del juego (compartida)
  globalSequence: string[]
  // Colores disponibles para toda la partida
  availableColors: string[]
  // Índice actual en la secuencia que debe repetirse
  currentSequenceIndex: number
  // Jugador que debe repetir la secuencia actual
  playerRepeatingUserId: number | null
  // Jugador que debe escoger el siguiente color
  playerChoosingUserId: number | null
  // Último color agregado para referencia
  lastAddedColor: string | null
}

export interface GameSimonSayCreateInput extends Omit<GameBaseCreateInput, 'status'> {
  gameType: 'simonsay'
  status?:
    | 'waiting'
    | 'started'
    | 'choosing_first_color'
    | 'repeating_sequence'
    | 'choosing_next_color'
    | 'finished'
  globalSequence?: string[]
  availableColors?: string[]
  currentSequenceIndex?: number
  playerRepeatingUserId?: number | null
  playerChoosingUserId?: number | null
  lastAddedColor?: string | null
}

const GameSimonSaySchema = new Schema({
  status: {
    type: String,
    enum: [
      'waiting',
      'started',
      'choosing_first_color',
      'repeating_sequence',
      'choosing_next_color',
      'finished',
    ],
    default: 'waiting',
  },
  globalSequence: { type: [String], default: [] },
  availableColors: { type: [String], required: true },
  currentSequenceIndex: { type: Number, default: 0 },
  playerRepeatingUserId: { type: Number, default: null },
  playerChoosingUserId: { type: Number, default: null },
  lastAddedColor: { type: String, default: null },
})

let GameSimonSayModel: Model<GameSimonSayDoc>

function getOrCreateSimonSayGameModel(): Model<GameSimonSayDoc> {
  if (!GameBaseModel) {
    throw new Error('GameBaseModel no está disponible')
  }

  if (GameBaseModel.discriminators?.simonsay) {
    return GameBaseModel.discriminators.simonsay as Model<GameSimonSayDoc>
  }

  const baseModel = mongoose.models.Game
  if (baseModel?.discriminators?.simonsay) {
    return baseModel.discriminators.simonsay as Model<GameSimonSayDoc>
  }

  try {
    const newDiscriminator = GameBaseModel.discriminator<GameSimonSayDoc>(
      'simonsay',
      GameSimonSaySchema
    )
    return newDiscriminator
  } catch (error) {
    throw new Error(`No se pudo crear el modelo GameSimonSay: ${error.message}`)
  }
}

try {
  GameSimonSayModel = getOrCreateSimonSayGameModel()
} catch (error) {
  console.error('Error inicializando GameSimonSayModel:', error)
  throw error
}

export class GameSimonSayModelClass extends BaseModel<GameSimonSayDoc, GameSimonSayCreateInput> {
  constructor() {
    super(GameSimonSayModel)
  }

  async addColorToSequence(gameId: string, color: string) {
    const game = await this.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    const newSequence = [...game.globalSequence, color]
    return this.update_by_id(gameId, {
      globalSequence: newSequence,
      lastAddedColor: color,
      currentSequenceIndex: 0, // Reiniciar índice para repetir toda la secuencia
    })
  }

  async updateSequenceProgress(gameId: string, newIndex: number) {
    return this.update_by_id(gameId, { currentSequenceIndex: newIndex })
  }

  async setPlayerStates(
    gameId: string,
    repeatingUserId: number | null,
    choosingUserId: number | null
  ) {
    return this.update_by_id(gameId, {
      playerRepeatingUserId: repeatingUserId,
      playerChoosingUserId: choosingUserId,
    })
  }
}

export { GameSimonSayModel }
