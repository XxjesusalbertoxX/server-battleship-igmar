import mongoose, { Schema, Model } from 'mongoose'
import { BaseModel } from '../base_model.js'
import {
  PlayerGameBaseDoc,
  PlayerGameBaseCreateInput,
  PlayerGameBaseModel,
} from '../player_game_base.js'

// Documento específico para Lotería
export interface PlayerGameLoteriaDoc extends PlayerGameBaseDoc {
  gameType: 'loteria'

  // Carta del jugador
  playerCard: string[] // 16 cartas de su tabla (4x4)

  // Estado del tablero
  markedCells: boolean[] // 16 posiciones marcadas (true/false)
  tokensUsed: number // Fichas utilizadas
  totalTokens: number // Fichas totales disponibles

  // Estado del jugador
  isHost: boolean // Si es el anfitrión
  isSpectator: boolean // Si está en modo espectador (hizo falta)
  cardGenerated: boolean // Si ya generó su carta

  // Verificación
  claimedWin: boolean // Si reclamó victoria
  claimTime?: Date // Cuándo reclamó
  verificationResult?: 'pending' | 'valid' | 'invalid' | null // Resultado de verificación
}

// Input específico para Lotería
export interface PlayerGameLoteriaCreateInput extends PlayerGameBaseCreateInput {
  gameType: 'loteria'
  playerCard?: string[]
  markedCells?: boolean[]
  tokensUsed?: number
  totalTokens?: number
  isHost?: boolean
  isSpectator?: boolean
  cardGenerated?: boolean
  claimedWin?: boolean
  claimTime?: Date
  verificationResult?: 'pending' | 'valid' | 'invalid' | null // CORREGIDO: Solo la interfaz TypeScript
}

// Schema específico para Lotería
const PlayerGameLoteriaSchema = new Schema({
  playerCard: { type: [String], default: [] },
  markedCells: { type: [Boolean], default: () => Array(16).fill(false) },
  tokensUsed: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 16 }, // Una ficha por celda
  isHost: { type: Boolean, default: false },
  isSpectator: { type: Boolean, default: false },
  cardGenerated: { type: Boolean, default: false },
  claimedWin: { type: Boolean, default: false },
  claimTime: { type: Date, default: null },
  verificationResult: {
    type: String,
    enum: ['pending', 'valid', 'invalid'],
    default: null, // CORREGIDO: Solo en el schema de Mongoose
  },
})

// LÓGICA ROBUSTA PARA OBTENER/CREAR EL DISCRIMINADOR
let PlayerGameLoteriaModel: Model<PlayerGameLoteriaDoc>

function getOrCreateLoteriaPlayerModel(): Model<PlayerGameLoteriaDoc> {
  if (!PlayerGameBaseModel) {
    throw new Error('PlayerGameBaseModel no está disponible')
  }

  // 1. Verificar si ya existe en el modelo base
  if (PlayerGameBaseModel.discriminators?.['player-loteria']) {
    return PlayerGameBaseModel.discriminators['player-loteria'] as Model<PlayerGameLoteriaDoc>
  }

  // 2. Verificar si existe en mongoose.models
  if (mongoose.models['PlayerGame-player-loteria']) {
    return mongoose.models['PlayerGame-player-loteria'] as Model<PlayerGameLoteriaDoc>
  }

  // 3. Crear el discriminador
  try {
    return PlayerGameBaseModel.discriminator<PlayerGameLoteriaDoc>(
      'player-loteria', // NOMBRE ÚNICO
      PlayerGameLoteriaSchema
    )
  } catch (error: any) {
    if (error.name === 'OverwriteModelError' && mongoose.models['PlayerGame-player-loteria']) {
      return mongoose.models['PlayerGame-player-loteria'] as Model<PlayerGameLoteriaDoc>
    }
    throw new Error(`No se pudo crear el modelo PlayerGameLoteria: ${error.message}`)
  }
}

// Obtener o crear el modelo
try {
  PlayerGameLoteriaModel = getOrCreateLoteriaPlayerModel()
} catch (error) {
  console.error('Error inicializando PlayerGameLoteriaModel:', error)
  throw error
}

export class PlayerGameLoteriaModelClass extends BaseModel<
  PlayerGameLoteriaDoc,
  PlayerGameLoteriaCreateInput
> {
  constructor() {
    super(PlayerGameLoteriaModel)
  }

  // Métodos específicos para Lotería
  async findByGameId(gameId: string) {
    return this.model.find({ gameId, gameType: 'loteria' })
  }

  async generateCard(playerId: string, cards: string[]) {
    return this.update_by_id(playerId, {
      playerCard: cards,
      cardGenerated: true,
      markedCells: Array(16).fill(false),
    })
  }

  async markCell(playerId: string, cellIndex: number) {
    const player = await this.find_by_id(playerId)
    if (!player) throw new Error('Jugador no encontrado')

    const newMarkedCells = [...player.markedCells]
    if (!newMarkedCells[cellIndex]) {
      newMarkedCells[cellIndex] = true
      const newTokensUsed = player.tokensUsed + 1

      return this.update_by_id(playerId, {
        markedCells: newMarkedCells,
        tokensUsed: newTokensUsed,
      })
    }
    return player
  }

  async claimWin(playerId: string) {
    return this.update_by_id(playerId, {
      claimedWin: true,
      claimTime: new Date(),
      verificationResult: 'pending',
    })
  }

  async setVerificationResult(playerId: string, result: 'valid' | 'invalid') {
    const updateData: any = { verificationResult: result }

    if (result === 'invalid') {
      updateData.isSpectator = true
      updateData.claimedWin = false
    }

    return this.update_by_id(playerId, updateData)
  }

  async resetClaim(playerId: string) {
    return this.update_by_id(playerId, {
      claimedWin: false,
      claimTime: undefined,
      verificationResult: undefined,
    })
  }
}

export { PlayerGameLoteriaModel }
