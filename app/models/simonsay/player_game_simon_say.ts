import mongoose, { Schema, Model } from 'mongoose'
import { BaseModel } from '../base_model.js'
import {
  PlayerGameBaseDoc,
  PlayerGameBaseCreateInput,
  PlayerGameBaseModel,
} from '../player_game_base.js'

export interface PlayerGameSimonSayDoc extends PlayerGameBaseDoc {
  gameType: 'simonsay'
  // Solo campos básicos, la secuencia está en Game
  customColorsSelected: boolean // Si ya seleccionó sus colores personalizados
}

export interface PlayerGameSimonSayCreateInput extends PlayerGameBaseCreateInput {
  gameType: 'simonsay'
  customColorsSelected?: boolean
}

const PlayerGameSimonSaySchema = new Schema({
  customColorsSelected: { type: Boolean, default: false },
})

let PlayerGameSimonSayModel: Model<PlayerGameSimonSayDoc>

function getOrCreateSimonSayModel(): Model<PlayerGameSimonSayDoc> {
  if (!PlayerGameBaseModel) {
    throw new Error('PlayerGameBaseModel no está disponible')
  }

  if (PlayerGameBaseModel.discriminators?.['player-simonsay']) {
    return PlayerGameBaseModel.discriminators['player-simonsay'] as Model<PlayerGameSimonSayDoc>
  }

  const baseModel = mongoose.models.PlayerGame
  if (baseModel?.discriminators?.['player-simonsay']) {
    return baseModel.discriminators['player-simonsay'] as Model<PlayerGameSimonSayDoc>
  }

  try {
    const newDiscriminator = PlayerGameBaseModel.discriminator<PlayerGameSimonSayDoc>(
      'player-simonsay',
      PlayerGameSimonSaySchema
    )
    return newDiscriminator
  } catch (error) {
    throw new Error(`No se pudo crear el modelo PlayerGameSimonSay: ${error.message}`)
  }
}

try {
  PlayerGameSimonSayModel = getOrCreateSimonSayModel()
} catch (error) {
  console.error('Error inicializando PlayerGameSimonSayModel:', error)
  throw error
}

export class PlayerGameSimonSayModelClass extends BaseModel<
  PlayerGameSimonSayDoc,
  PlayerGameSimonSayCreateInput
> {
  constructor() {
    super(PlayerGameSimonSayModel)
  }

  async findByGameId(gameId: string) {
    return this.model.find({ gameId, gameType: 'simonsay' })
  }

  async markColorsSelected(playerId: string) {
    return this.update_by_id(playerId, { customColorsSelected: true })
  }
}

export { PlayerGameSimonSayModel }
