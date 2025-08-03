import mongoose, { Schema, Model } from 'mongoose'
import { BaseModel } from '../base_model.js'

// IMPORTANTE: Importar el modelo base para asegurar que se inicialice primero
import {
  PlayerGameBaseDoc,
  PlayerGameBaseCreateInput,
  PlayerGameBaseModel,
} from '../player_game_base.js'

// Documento específico para Simon Say - SOLO campos de Simon Say
export interface PlayerGameSimonSayDoc extends PlayerGameBaseDoc {
  gameType: 'simonsay'
  customColors: string[]
  sequence: string[]
  currentSequenceIndex: number
}

// Input específico para Simon Say - SOLO campos de Simon Say
export interface PlayerGameSimonSayCreateInput extends PlayerGameBaseCreateInput {
  gameType: 'simonsay'
  customColors?: string[]
  sequence?: string[]
  currentSequenceIndex?: number
}

// Schema específico para Simon Say - SOLO campos de Simon Say
const PlayerGameSimonSaySchema = new Schema({
  customColors: {
    type: [String],
    required: true,
    default: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#800080', '#FFA500'],
  },
  sequence: {
    type: [String],
    default: [],
  },
  currentSequenceIndex: {
    type: Number,
    default: 0,
  },
})

let PlayerGameSimonSayModel: Model<PlayerGameSimonSayDoc>

function getOrCreateSimonSayModel(): Model<PlayerGameSimonSayDoc> {
  // VERIFICAR QUE EL MODELO BASE EXISTA Y ESTÉ DISPONIBLE
  if (!PlayerGameBaseModel) {
    throw new Error('PlayerGameBaseModel no está disponible')
  }

  console.log('PlayerGameBaseModel disponible para simonsay:', !!PlayerGameBaseModel)

  // 1. Verificar si ya existe en el modelo base
  if (PlayerGameBaseModel.discriminators?.['player-simonsay']) {
    console.log('Discriminador player-simonsay encontrado en modelo base')
    return PlayerGameBaseModel.discriminators['player-simonsay'] as Model<PlayerGameSimonSayDoc>
  }

  // 2. Verificar si existe en mongoose.models
  const baseModel = mongoose.models.PlayerGame
  if (baseModel?.discriminators?.['player-simonsay']) {
    console.log('Discriminador player-simonsay encontrado en mongoose.models')
    return baseModel.discriminators['player-simonsay'] as Model<PlayerGameSimonSayDoc>
  }

  // 3. Crear el discriminador
  try {
    console.log('Creando discriminador player-simonsay...')
    const newDiscriminator = PlayerGameBaseModel.discriminator<PlayerGameSimonSayDoc>(
      'player-simonsay', // NOMBRE ÚNICO
      PlayerGameSimonSaySchema
    )
    console.log('Discriminador player-simonsay creado exitosamente')
    return newDiscriminator
  } catch (error) {
    console.error('Error detallado creando discriminador player-simonsay:', error)
    throw new Error(`No se pudo crear el modelo PlayerGameSimonSay: ${error.message}`)
  }
}

// ESPERAR A QUE EL MODELO BASE ESTÉ DISPONIBLE ANTES DE CREAR EL DISCRIMINADOR
try {
  PlayerGameSimonSayModel = getOrCreateSimonSayModel()
} catch (error) {
  console.error('Error inicializando PlayerGameSimonSayModel:', error)
  throw error
}

export class PlayerGameSimonSayModelClass extends BaseModel<
  PlayerGameSimonSayDoc,
  PlayerGameSimonSayCreateInput
> {
  constructor() {
    super(PlayerGameSimonSayModel)
  }
  // Métodos específicos para Simon Say
  async findByGameId(gameId: string) {
    return this.model.find({ gameId, gameType: 'simonsay' })
  }

  async updateSequence(playerId: string, sequence: string[]) {
    return this.update_by_id(playerId, { sequence })
  }

  async updateCurrentIndex(playerId: string, index: number) {
    return this.update_by_id(playerId, { currentSequenceIndex: index })
  }

  async updateColors(playerId: string, customColors: string[]) {
    return this.update_by_id(playerId, { customColors })
  }
}

export { PlayerGameSimonSayModel }
