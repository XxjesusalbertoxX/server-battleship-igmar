import mongoose, { Schema, model, Document, Model, Types } from 'mongoose'
import { BaseModel } from './base_model.js'

// Documento completo
export interface GameDoc extends Document {
  _id: Types.ObjectId
  status:
    | 'waiting'
    | 'started'
    | 'in_progress'
    | 'waiting_first_color'
    | 'repeating_sequence'
    | 'choosing_next_color'
    | 'finished'
  code: string
  hasStarted: boolean
  currentTurnUserId: number | null
  gameType: 'simonsay' | 'battleship'
  players: Types.ObjectId[]
  customColors?: string[]
  sequence?: string[]
  lastChosenColor?: string
  winner?: number | null
  rematchRequestedBy?: Types.ObjectId[]
  surrenderedBy?: Types.ObjectId[]
  createdAt?: Date
  updatedAt?: Date
}

// Input solo para crear
export interface GameCreateInput {
  status?:
    | 'waiting'
    | 'started'
    | 'in_progress'
    | 'waiting_first_color'
    | 'repeating_sequence'
    | 'choosing_next_color'
    | 'finished'
  code: string
  hasStarted?: boolean
  currentTurnUserId?: number | null
  gameType: 'simonsay' | 'battleship'
  players: Types.ObjectId[]
  customColors?: string[]
  winner?: number | null
  rematchRequestedBy?: Types.ObjectId[]
  surrenderedBy?: Types.ObjectId[]
}

const GameSchema = new Schema<GameDoc>(
  {
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
    code: { type: String, required: true },
    hasStarted: { type: Boolean, default: false },
    currentTurnUserId: { type: Number, default: null },
    gameType: { type: String, enum: ['simonsay', 'battleship'], default: 'battleship' },
    players: [{ type: Schema.Types.ObjectId, ref: 'PlayerGame' }],
    customColors: { type: [String], default: undefined },
    sequence: { type: [String], default: undefined },
    lastChosenColor: { type: String, default: undefined },
    winner: { type: Number, default: null },
    rematchRequestedBy: [{ type: Schema.Types.ObjectId, ref: 'PlayerGame' }],
    surrenderedBy: [{ type: Schema.Types.ObjectId, ref: 'PlayerGame' }],
  },
  { timestamps: true }
)

const GameMongooseModel: Model<GameDoc> = mongoose.models.Game || model<GameDoc>('Game', GameSchema)

export class GameModel extends BaseModel<GameDoc, GameCreateInput> {
  constructor() {
    super(GameMongooseModel)
  }

  async find_by_player_game_id(playerGameId: Types.ObjectId) {
    return this.model.findOne({ players: playerGameId })
  }
}
