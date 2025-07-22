import mongoose, { Schema, model, Document, Model, Types } from 'mongoose'
import { BaseModel } from './base_model.js'

// Documento completo con todos los campos para PlayerGame
export interface PlayerGameDoc extends Document {
  _id: Types.ObjectId
  userId: number
  gameId: Types.ObjectId
  board?: number[][]
  result: 'win' | 'lose' | 'pending'
  shipsSunk: number
  shipsLost: number
  lastSeenAt?: Date | null
  ready: boolean
  customColors?: string[]
  rematchAccepted: boolean
  sequence: string[] // Secuencia de colores para el juego Simon Says
  createdAt?: Date
  updatedAt?: Date
}

// Campos solo para creación
export interface PlayerGameCreateInput {
  userId: number
  gameId: Types.ObjectId
  board?: number[][]
  result?: 'win' | 'lose' | 'pending'
  shipsSunk?: number
  shipsLost?: number
  lastSeenAt?: Date | null
  ready?: boolean
  customColors?: string[]
  rematchAccepted?: boolean
  sequence?: string[] // Secuencia de colores para el juego Simon Says
}

const PlayerGameSchema = new Schema<PlayerGameDoc>(
  {
    userId: { type: Number, required: true },
    gameId: { type: Schema.Types.ObjectId, required: true, ref: 'Game' },
    board: { type: [[Number]], required: false, default: undefined },
    result: { type: String, enum: ['win', 'lose', 'pending'], default: 'pending' },
    shipsSunk: { type: Number, default: 0 },
    shipsLost: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: null },
    ready: { type: Boolean, default: false },
    customColors: { type: [String], default: undefined },
    rematchAccepted: { type: Boolean, default: false },
    sequence: { type: [String], default: [] }, // Nueva secuencia para cada jugador
  },
  { timestamps: true }
)

const PlayerGameMongooseModel: Model<PlayerGameDoc> =
  mongoose.models.PlayerGame || model<PlayerGameDoc>('PlayerGame', PlayerGameSchema)

export class PlayerGameModel extends BaseModel<PlayerGameDoc, PlayerGameCreateInput> {
  constructor() {
    super(PlayerGameMongooseModel)
  }
}
