import mongoose, { Schema, Document, Model, Types } from 'mongoose'
import { BaseModel } from './base_model.js'

// LIMPIEZA PARA DESARROLLO - Solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  // Limpiar modelos existentes
  delete mongoose.models.PlayerGame

  // Limpiar discriminadores si existen
  if (mongoose.models.PlayerGame?.discriminators) {
    delete mongoose.models.PlayerGame.discriminators.battleship
    delete mongoose.models.PlayerGame.discriminators.simonsay
  }
}

// Documento base con campos comunes
export interface PlayerGameBaseDoc extends Document {
  _id: Types.ObjectId
  userId: number
  gameId: Types.ObjectId
  gameType: 'battleship' | 'simonsay' | 'loteria' // Campo discriminador
  result: 'win' | 'lose' | 'pending'
  lastSeenAt?: Date | null
  ready: boolean
  rematchAccepted: boolean
  createdAt?: Date
  updatedAt?: Date
}

// Input base para creación
export interface PlayerGameBaseCreateInput {
  userId: number
  gameId: Types.ObjectId
  gameType: 'battleship' | 'simonsay' | 'loteria'
  result?: 'win' | 'lose' | 'pending'
  lastSeenAt?: Date | null
  ready?: boolean
  rematchAccepted?: boolean
}

// Schema base con campos comunes
export const PlayerGameBaseSchema = new Schema<PlayerGameBaseDoc>(
  {
    userId: { type: Number, required: true },
    gameId: { type: Schema.Types.ObjectId, required: true, ref: 'Game' },
    gameType: {
      type: String,
      enum: ['battleship', 'simonsay', 'loteria'],
      required: true,
    },
    result: { type: String, enum: ['win', 'lose', 'pending'], default: 'pending' },
    lastSeenAt: { type: Date, default: null },
    ready: { type: Boolean, default: false },
    rematchAccepted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    discriminatorKey: '_type', // Campo que determina el tipo
  }
)

// FORZAR LA CREACIÓN DEL MODELO BASE INMEDIATAMENTE
let PlayerGameBaseModel: Model<PlayerGameBaseDoc>

try {
  // Intentar obtener el modelo existente
  PlayerGameBaseModel = mongoose.models.PlayerGame as Model<PlayerGameBaseDoc>

  // Si no existe, crearlo
  if (!PlayerGameBaseModel) {
    PlayerGameBaseModel = mongoose.model<PlayerGameBaseDoc>('PlayerGame', PlayerGameBaseSchema)
  }
} catch (error) {
  // Si hay error, crear el modelo
  PlayerGameBaseModel = mongoose.model<PlayerGameBaseDoc>('PlayerGame', PlayerGameBaseSchema)
}

export class PlayerGameBaseModelClass extends BaseModel<
  PlayerGameBaseDoc,
  PlayerGameBaseCreateInput
> {
  constructor() {
    super(PlayerGameBaseModel)
  }
}

export { PlayerGameBaseModel }
