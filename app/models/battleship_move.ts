import { Schema, model, Document, Model, Types } from 'mongoose'
import { BaseModel } from './base_model.js'

// Documento completo
export interface MoveDoc extends Document {
  _id: Types.ObjectId
  playerGameId: Types.ObjectId
  x: number
  y: number
  hit: boolean
  createdAt?: Date
  updatedAt?: Date
}

// Input para crear un move
export interface MoveCreateInput {
  playerGameId: Types.ObjectId
  x: number
  y: number
  hit: boolean
}

const MoveSchema = new Schema<MoveDoc>(
  {
    playerGameId: {
      type: Schema.Types.ObjectId,
      ref: 'PlayerGame',
      required: true,
    },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    hit: { type: Boolean, required: true },
  },
  { timestamps: true }
)

const MoveMongooseModel: Model<MoveDoc> = model<MoveDoc>('Move', MoveSchema)

export class MoveModel extends BaseModel<MoveDoc, MoveCreateInput> {
  constructor() {
    super(MoveMongooseModel)
  }

  async find_by_player_game_id(playerGameId: Types.ObjectId) {
    return this.model.find({ playerGameId })
  }
}
