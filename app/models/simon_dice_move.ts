import { Schema, model, Document, Model, Types } from 'mongoose'
import { BaseModel } from './base_model.js'

// Documento completo para Simon Dice
export interface MoveSimonDiceDoc extends Document {
  _id: Types.ObjectId
  playerGameId: Types.ObjectId
  sequence: string[] // Ejemplo: secuencia de colores o botones
  createdAt?: Date
  updatedAt?: Date
}

// Input para crear un movimiento en Simon Dice
export interface MoveSimonDiceCreateInput {
  playerGameId: Types.ObjectId
  sequence: string[]
}

const MoveSimonDiceSchema = new Schema<MoveSimonDiceDoc>(
  {
    playerGameId: {
      type: Schema.Types.ObjectId,
      ref: 'PlayerGame',
      required: true,
    },
    sequence: {
      type: [String], // Array de strings para representar la secuencia
      required: true,
    },
  },
  { timestamps: true }
)

const MoveSimonDiceMongooseModel: Model<MoveSimonDiceDoc> = model<MoveSimonDiceDoc>(
  'MoveSimonDice',
  MoveSimonDiceSchema
)

export class MoveSimonDiceModel extends BaseModel<MoveSimonDiceDoc, MoveSimonDiceCreateInput> {
  constructor() {
    super(MoveSimonDiceMongooseModel)
  }
}
