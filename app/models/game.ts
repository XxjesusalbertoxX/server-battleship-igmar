import { Schema, model, Document, Model, Types } from 'mongoose'
import { BaseModel } from './base_model.js'

// Documento completo
export interface GameDoc extends Document {
  _id: Types.ObjectId
  status: 'waiting' | 'started' | 'in_progress' | 'finished'
  code: string
  hasStarted: boolean
  currentTurnUserId: number | null
  gameType: 'simonsay' | 'battleship'
  players: Types.ObjectId[]
  customColors?: string[]
  createdAt?: Date
  updatedAt?: Date
}

// Input solo para crear
export interface GameCreateInput {
  status?: 'waiting' | 'started' | 'in_progress' | 'finished'
  code: string
  hasStarted?: boolean
  currentTurnUserId?: number | null
  gameType: 'simonsay' | 'battleship'
  players: Types.ObjectId[]
  customColors?: string[]
}

const GameSchema = new Schema<GameDoc>(
  {
    status: {
      type: String,
      enum: ['waiting', 'started', 'in_progress', 'finished'],
      default: 'waiting',
    },
    code: { type: String, required: true },
    hasStarted: { type: Boolean, default: false },
    currentTurnUserId: { type: Number, default: null },
    gameType: { type: String, enum: ['simonsay', 'battleship'], default: 'battleship' },
    players: [{ type: Schema.Types.ObjectId, ref: 'PlayerGame' }],
    customColors: { type: [String], default: undefined },
  },
  { timestamps: true }
)

const GameMongooseModel: Model<GameDoc> = model<GameDoc>('Game', GameSchema)

export class GameModel extends BaseModel<GameDoc, GameCreateInput> {
  constructor() {
    super(GameMongooseModel)
  }

  async find_by_player_game_id(playerGameId: Types.ObjectId) {
    return this.model.findOne({ players: playerGameId })
  }
}
