import mongoose, { Schema, Model } from 'mongoose'
import { BaseModel } from '../base_model.js'

// IMPORTANTE: Importar el modelo base para asegurar que se inicialice primero
import { GameBaseDoc, GameBaseCreateInput, GameBaseModel } from '../game_base.js'

// Documento específico para Simon Say - SOLO campos de Simon Say
export interface GameSimonSayDoc extends Omit<GameBaseDoc, 'status'> {
  gameType: 'simonsay'
  // Estados específicos de Simon Say
  status:
    | 'waiting'
    | 'started'
    | 'in_progress'
    | 'waiting_first_color'
    | 'repeating_sequence'
    | 'choosing_next_color'
    | 'finished'
  // Campos específicos de Simon Say
  globalSequence?: string[]
  lastChosenColor?: string
  currentRound?: number
}

// Input específico para Simon Say
export interface GameSimonSayCreateInput extends Omit<GameBaseCreateInput, 'status'> {
  gameType: 'simonsay'
  status?:
    | 'waiting'
    | 'started'
    | 'in_progress'
    | 'waiting_first_color'
    | 'repeating_sequence'
    | 'choosing_next_color'
    | 'finished'
  globalSequence?: string[]
  lastChosenColor?: string
  currentRound?: number
}

// Schema específico para Simon Say
const GameSimonSaySchema = new Schema({
  status: {
    type: String,
    enum: [
      'waiting',
      'started',
      'in_progress',
      'waiting_first_color',
      'repeating_sequence',
      'choosing_next_color',
      'finished',
    ],
    default: 'waiting',
  },
  globalSequence: { type: [String], default: undefined },
  lastChosenColor: { type: String, default: undefined },
  currentRound: { type: Number, default: 0 },
})

// LÓGICA MEJORADA CON VALIDACIÓN DEL MODELO BASE
let GameSimonSayModel: Model<GameSimonSayDoc>

function getOrCreateSimonSayGameModel(): Model<GameSimonSayDoc> {
  // VERIFICAR QUE EL MODELO BASE EXISTA Y ESTÉ DISPONIBLE
  if (!GameBaseModel) {
    throw new Error('GameBaseModel no está disponible')
  }

  console.log('GameBaseModel disponible para simonsay:', !!GameBaseModel)

  // 1. Verificar si ya existe en el modelo base
  if (GameBaseModel.discriminators?.simonsay) {
    console.log('Discriminador simonsay (Game) encontrado en modelo base')
    return GameBaseModel.discriminators.simonsay as Model<GameSimonSayDoc>
  }

  // 2. Verificar si existe en mongoose.models
  const baseModel = mongoose.models.Game
  if (baseModel?.discriminators?.simonsay) {
    console.log('Discriminador simonsay (Game) encontrado en mongoose.models')
    return baseModel.discriminators.simonsay as Model<GameSimonSayDoc>
  }

  // 3. Crear el discriminador
  try {
    console.log('Creando discriminador simonsay para Game...')
    const newDiscriminator = GameBaseModel.discriminator<GameSimonSayDoc>(
      'simonsay',
      GameSimonSaySchema
    )
    console.log('Discriminador simonsay (Game) creado exitosamente')
    return newDiscriminator
  } catch (error) {
    console.error('Error detallado creando discriminador simonsay (Game):', error)
    throw new Error(`No se pudo crear el modelo GameSimonSay: ${error.message}`)
  }
}

// ESPERAR A QUE EL MODELO BASE ESTÉ DISPONIBLE ANTES DE CREAR EL DISCRIMINADOR
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

  // Métodos específicos para Simon Say
  async findWaitingSimonSayGames() {
    return this.model.find({ gameType: 'simonsay', status: 'waiting' })
  }

  async findActiveSimonSayGames() {
    return this.model.find({
      gameType: 'simonsay',
      status: {
        $in: [
          'started',
          'in_progress',
          'waiting_first_color',
          'repeating_sequence',
          'choosing_next_color',
        ],
      },
    })
  }

  async updateGlobalSequence(gameId: string, sequence: string[]) {
    return this.update_by_id(gameId, { globalSequence: sequence })
  }

  async addColorToGlobalSequence(gameId: string, color: string) {
    const game = await this.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    const newSequence = [...(game.globalSequence || []), color]
    return this.update_by_id(gameId, {
      globalSequence: newSequence,
      lastChosenColor: color,
    })
  }
}

export { GameSimonSayModel }
