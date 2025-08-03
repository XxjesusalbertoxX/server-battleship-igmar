import mongoose, { Schema, Model } from 'mongoose'
import { BaseModel } from '../base_model.js'
import { GameBaseDoc, GameBaseCreateInput, GameBaseModel } from '../game_base.js'

// Documento específico para Lotería
export interface GameLoteriaDoc extends Omit<GameBaseDoc, 'status'> {
  gameType: 'loteria'
  // Estados específicos de Lotería
  status:
    | 'waiting' // Esperando jugadores
    | 'card_selection' // Jugadores eligiendo cartas
    | 'ready_check' // Esperando que todos estén ready
    | 'in_progress' // Juego en curso
    | 'verification' // Verificando ganador
    | 'finished' // Juego terminado

  // Configuración del juego
  minPlayers: number // Mínimo 4
  maxPlayers: number // Máximo 16
  hostUserId: number // ID del anfitrión

  // Estado del juego
  currentCard?: string // Carta actual que sacó el anfitrión
  drawnCards: string[] // Cartas que ya han salido
  availableCards: string[] // Cartas disponibles en la baraja

  // Verificación
  playerUnderReview?: number // ID del jugador en revisión
  reviewStartTime?: Date // Cuándo empezó la revisión
}

// Input específico para Lotería
export interface GameLoteriaCreateInput extends Omit<GameBaseCreateInput, 'status'> {
  gameType: 'loteria'
  status?:
    | 'waiting'
    | 'card_selection'
    | 'ready_check'
    | 'in_progress'
    | 'verification'
    | 'finished'
  minPlayers: number
  maxPlayers: number
  hostUserId: number
  currentCard?: string
  drawnCards?: string[]
  availableCards?: string[]
  playerUnderReview?: number
  reviewStartTime?: Date
}

// Schema específico para Lotería
const GameLoteriaSchema = new Schema({
  status: {
    type: String,
    enum: ['waiting', 'card_selection', 'ready_check', 'in_progress', 'verification', 'finished'],
    default: 'waiting',
  },
  minPlayers: { type: Number, required: true, min: 4, max: 16 },
  maxPlayers: { type: Number, required: true, min: 4, max: 16 },
  hostUserId: { type: Number, required: true },
  currentCard: { type: String, default: null },
  drawnCards: { type: [String], default: [] },
  availableCards: { type: [String], default: [] },
  playerUnderReview: { type: Number, default: null },
  reviewStartTime: { type: Date, default: null },
})

// LÓGICA ROBUSTA PARA OBTENER/CREAR EL DISCRIMINADOR
let GameLoteriaModel: Model<GameLoteriaDoc>

function getOrCreateLoteriaGameModel(): Model<GameLoteriaDoc> {
  if (!GameBaseModel) {
    throw new Error('GameBaseModel no está disponible')
  }

  // 1. Verificar si ya existe en el modelo base
  if (GameBaseModel.discriminators?.loteria) {
    return GameBaseModel.discriminators.loteria as Model<GameLoteriaDoc>
  }

  // 2. Verificar si existe en mongoose.models
  const baseModel = mongoose.models.Game
  if (baseModel?.discriminators?.loteria) {
    return baseModel.discriminators.loteria as Model<GameLoteriaDoc>
  }

  // 3. Crear el discriminador
  try {
    return GameBaseModel.discriminator<GameLoteriaDoc>('loteria', GameLoteriaSchema)
  } catch (error: any) {
    if (error.name === 'OverwriteModelError' && mongoose.models['Game-loteria']) {
      return mongoose.models['Game-loteria'] as Model<GameLoteriaDoc>
    }
    throw new Error(`No se pudo crear el modelo GameLoteria: ${error.message}`)
  }
}

// Obtener o crear el modelo
try {
  GameLoteriaModel = getOrCreateLoteriaGameModel()
} catch (error) {
  console.error('Error inicializando GameLoteriaModel:', error)
  throw error
}

export class GameLoteriaModelClass extends BaseModel<GameLoteriaDoc, GameLoteriaCreateInput> {
  constructor() {
    super(GameLoteriaModel)
  }

  // Métodos específicos para Lotería
  async findWaitingLoteriaGames() {
    return this.model.find({ gameType: 'loteria', status: 'waiting' })
  }

  async findActiveLoteriaGames() {
    return this.model.find({
      gameType: 'loteria',
      status: { $in: ['card_selection', 'ready_check', 'in_progress', 'verification'] },
    })
  }

  async drawCard(gameId: string, card: string) {
    const game = await this.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    const newDrawnCards = [...game.drawnCards, card]
    const newAvailableCards = game.availableCards.filter((c) => c !== card)

    return this.update_by_id(gameId, {
      currentCard: card,
      drawnCards: newDrawnCards,
      availableCards: newAvailableCards,
    })
  }

  async reshuffleCards(gameId: string, newCards: string[]) {
    return this.update_by_id(gameId, {
      currentCard: undefined,
      drawnCards: [],
      availableCards: newCards,
    })
  }

  async startReview(gameId: string, playerId: number) {
    return this.update_by_id(gameId, {
      status: 'verification',
      playerUnderReview: playerId,
      reviewStartTime: new Date(),
    })
  }

  async endReview(gameId: string, isWinner: boolean) {
    if (isWinner) {
      return this.update_by_id(gameId, {
        status: 'finished',
        playerUnderReview: undefined,
        reviewStartTime: undefined,
      })
    } else {
      return this.update_by_id(gameId, {
        status: 'in_progress',
        playerUnderReview: undefined,
        reviewStartTime: undefined,
      })
    }
  }
}

export { GameLoteriaModel }
