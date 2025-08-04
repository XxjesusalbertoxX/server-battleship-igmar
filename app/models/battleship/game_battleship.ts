import mongoose, { Schema, Model } from 'mongoose'
import { BaseModel } from '../base_model.js'

// IMPORTANTE: Importar el modelo base para asegurar que se inicialice primero
import { GameBaseDoc, GameBaseCreateInput, GameBaseModel } from '../game_base.js'

// Documento específico para Battleship - SOLO campos de batalla naval
export interface GameBattleshipDoc extends GameBaseDoc {
  gameType: 'battleship'
  status: 'waiting' | 'started' | 'in_progress' | 'finished'
  boardSize?: number
  totalShips?: number
}

// Input específico para Battleship
export interface GameBattleshipCreateInput extends GameBaseCreateInput {
  gameType: 'battleship'
  status?: 'waiting' | 'started' | 'in_progress' | 'finished'
  boardSize?: number
  totalShips?: number
}

// Schema específico para Battleship - SOLO campos de batalla naval
const GameBattleshipSchema = new Schema({
  status: {
    type: String,
    enum: ['waiting', 'started', 'in_progress', 'finished'],
    default: 'waiting',
  },
  boardSize: { type: Number, default: 10 },
  totalShips: { type: Number, default: 15 },
})

// LÓGICA MEJORADA CON VALIDACIÓN DEL MODELO BASE
let GameBattleshipModel: Model<GameBattleshipDoc>

function getOrCreateBattleshipGameModel(): Model<GameBattleshipDoc> {
  // VERIFICAR QUE EL MODELO BASE EXISTA Y ESTÉ DISPONIBLE
  if (!GameBaseModel) {
    throw new Error('GameBaseModel no está disponible')
  }

  // 1. Verificar si ya existe en el modelo base
  if (GameBaseModel.discriminators?.battleship) {
    return GameBaseModel.discriminators.battleship as Model<GameBattleshipDoc>
  }

  // 2. Verificar si existe en mongoose.models
  const baseModel = mongoose.models.Game
  if (baseModel?.discriminators?.battleship) {
    return baseModel.discriminators.battleship as Model<GameBattleshipDoc>
  }

  // 3. Crear el discriminador
  try {
    const newDiscriminator = GameBaseModel.discriminator<GameBattleshipDoc>(
      'battleship',
      GameBattleshipSchema
    )
    return newDiscriminator
  } catch (error) {
    console.error('Error detallado creando discriminador battleship (Game):', error)
    console.error('GameBaseModel.discriminators:', GameBaseModel.discriminators)
    console.error('mongoose.models.Game:', mongoose.models.Game)
    throw new Error(`No se pudo crear el modelo GameBattleship: ${error.message}`)
  }
}

// ESPERAR A QUE EL MODELO BASE ESTÉ DISPONIBLE ANTES DE CREAR EL DISCRIMINADOR
try {
  GameBattleshipModel = getOrCreateBattleshipGameModel()
} catch (error) {
  console.error('Error inicializando GameBattleshipModel:', error)
  throw error
}

export class GameBattleshipModelClass extends BaseModel<
  GameBattleshipDoc,
  GameBattleshipCreateInput
> {
  constructor() {
    super(GameBattleshipModel)
  }

  async findWaitingBattleshipGames() {
    return this.model.find({ gameType: 'battleship', status: 'waiting' })
  }

  async findActiveBattleshipGames() {
    return this.model.find({
      gameType: 'battleship',
      status: { $in: ['started', 'in_progress'] },
    })
  }
}

export { GameBattleshipModel }
