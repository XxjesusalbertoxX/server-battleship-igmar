import mongoose, { Schema, Document, Model, Types } from 'mongoose'
import { BaseModel } from './base_model.js'

// LIMPIEZA PARA DESARROLLO - Solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  // Limpiar modelos existentes
  delete mongoose.models.Game

  // Limpiar discriminadores si existen
  if (mongoose.models.Game?.discriminators) {
    delete mongoose.models.Game.discriminators.battleship
    delete mongoose.models.Game.discriminators.simonsay
  }
}

// Documento base con campos comunes
export interface GameBaseDoc extends Document {
  _id: Types.ObjectId
  status: 'waiting' | 'started' | 'in_progress' | 'finished'
  code: string
  hasStarted: boolean
  currentTurnUserId: number | null
  gameType: 'battleship' | 'simonsay' | 'loteria'
  players: Types.ObjectId[]
  winner?: number | null
  rematchRequestedBy?: Types.ObjectId[]
  surrenderedBy?: Types.ObjectId[]
  createdAt?: Date
  updatedAt?: Date
}

// Input base para creación
export interface GameBaseCreateInput {
  status?: 'waiting' | 'started' | 'in_progress' | 'finished'
  code: string
  hasStarted?: boolean
  currentTurnUserId?: number | null
  gameType: 'battleship' | 'simonsay' | 'loteria'
  players: Types.ObjectId[]
  winner?: number | null
  rematchRequestedBy?: Types.ObjectId[]
  surrenderedBy?: Types.ObjectId[]
}

// Schema base con campos comunes
export const GameBaseSchema = new Schema<GameBaseDoc>(
  {
    status: {
      type: String,
      enum: ['waiting', 'started', 'in_progress', 'finished'],
      default: 'waiting',
    },
    code: { type: String, required: true },
    hasStarted: { type: Boolean, default: false },
    currentTurnUserId: { type: Number, default: null },
    gameType: {
      type: String,
      enum: ['battleship', 'simonsay', 'loteria'],
      required: true,
    },
    players: [{ type: Schema.Types.ObjectId, ref: 'PlayerGame' }],
    winner: { type: Number, default: null },
    rematchRequestedBy: [{ type: Schema.Types.ObjectId, ref: 'PlayerGame' }],
    surrenderedBy: [{ type: Schema.Types.ObjectId, ref: 'PlayerGame' }],
  },
  {
    timestamps: true,
    discriminatorKey: '_type',
  }
)

// FORZAR LA CREACIÓN DEL MODELO BASE INMEDIATAMENTE
let GameBaseModel: Model<GameBaseDoc>

try {
  // Intentar obtener el modelo existente
  GameBaseModel = mongoose.models.Game as Model<GameBaseDoc>

  // Si no existe, crearlo
  if (!GameBaseModel) {
    GameBaseModel = mongoose.model<GameBaseDoc>('Game', GameBaseSchema)
  }
} catch (error) {
  // Si hay error, crear el modelo
  GameBaseModel = mongoose.model<GameBaseDoc>('Game', GameBaseSchema)
}

export class GameBaseModelClass extends BaseModel<GameBaseDoc, GameBaseCreateInput> {
  constructor() {
    super(GameBaseModel)
  }
}

export { GameBaseModel }
