import mongoose, { Schema, model, Document, Model, Types } from 'mongoose'
import { BaseModel } from './base_model.js'

// Documento completo con todos los campos
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
  },
  { timestamps: true }
)

const PlayerGameMongooseModel: Model<PlayerGameDoc> =
  mongoose.models.PlayerGame || model<PlayerGameDoc>('PlayerGame', PlayerGameSchema)

// Ahora usando los dos tipos
export class PlayerGameModel extends BaseModel<PlayerGameDoc, PlayerGameCreateInput> {
  constructor() {
    super(PlayerGameMongooseModel)
  }
}
