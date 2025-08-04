import mongoose, { Schema, Model } from 'mongoose'
import { BaseModel } from '../base_model.js'

// IMPORTANTE: Importar el modelo base para asegurar que se inicialice primero
import {
  PlayerGameBaseDoc,
  PlayerGameBaseCreateInput,
  PlayerGameBaseModel,
} from '../player_game_base.js'

// Documento específico para Battleship - SOLO campos de batalla naval
export interface PlayerGameBattleshipDoc extends PlayerGameBaseDoc {
  gameType: 'battleship'
  board: number[][]
  shipsSunk: number
  shipsLost: number
}

// Input específico para Battleship - SOLO campos de batalla naval
export interface PlayerGameBattleshipCreateInput extends PlayerGameBaseCreateInput {
  gameType: 'battleship'
  board?: number[][]
  shipsSunk?: number
  shipsLost?: number
}

// Schema específico para Battleship - SOLO campos de batalla naval
const PlayerGameBattleshipSchema = new Schema({
  board: {
    type: [[Number]],
    required: true,
    default: () =>
      Array(10)
        .fill(null)
        .map(() => Array(10).fill(0)),
  },
  shipsSunk: { type: Number, default: 0 },
  shipsLost: { type: Number, default: 0 },
})

// LÓGICA MEJORADA CON VALIDACIÓN DEL MODELO BASE
let PlayerGameBattleshipModel: Model<PlayerGameBattleshipDoc>

function getOrCreateBattleshipPlayerModel(): Model<PlayerGameBattleshipDoc> {
  // 1. Verificar si ya existe en el modelo base con nombre único
  if (PlayerGameBaseModel.discriminators?.['player-battleship']) {
    return PlayerGameBaseModel.discriminators['player-battleship'] as Model<PlayerGameBattleshipDoc>
  }

  // 2. Verificar si existe en mongoose.models
  if (mongoose.models['PlayerGame-player-battleship']) {
    return mongoose.models['PlayerGame-player-battleship'] as Model<PlayerGameBattleshipDoc>
  }

  // 3. Crear el discriminador con nombre único
  try {
    return PlayerGameBaseModel.discriminator<PlayerGameBattleshipDoc>(
      'player-battleship', // NOMBRE ÚNICO
      PlayerGameBattleshipSchema
    )
  } catch (error: any) {
    // Si el error es OverwriteModelError, retorna el modelo existente
    if (error.name === 'OverwriteModelError' && mongoose.models['PlayerGame-player-battleship']) {
      return mongoose.models['PlayerGame-player-battleship'] as Model<PlayerGameBattleshipDoc>
    }
    console.error('Error detallado creando discriminador player-battleship:', error)
    throw new Error(`No se pudo crear el modelo PlayerGameBattleship: ${error.message}`)
  }
}

// ESPERAR A QUE EL MODELO BASE ESTÉ DISPONIBLE ANTES DE CREAR EL DISCRIMINADOR
try {
  PlayerGameBattleshipModel = getOrCreateBattleshipPlayerModel()
} catch (error) {
  console.error('Error inicializando PlayerGameBattleshipModel:', error)
  throw error
}

export class PlayerGameBattleshipModelClass extends BaseModel<
  PlayerGameBattleshipDoc,
  PlayerGameBattleshipCreateInput
> {
  constructor() {
    super(PlayerGameBattleshipModel)
  }

  // Métodos específicos para Battleship
  async findByGameId(gameId: string) {
    return this.model.find({ gameId, gameType: 'battleship' })
  }

  async updateBoard(playerId: string, board: number[][]) {
    const result = await this.update_by_id(playerId, { board })
    return result
  }

  async updateShipsCount(playerId: string, shipsSunk: number, shipsLost: number) {
    return this.update_by_id(playerId, { shipsSunk, shipsLost })
  }
}

export { PlayerGameBattleshipModel }
