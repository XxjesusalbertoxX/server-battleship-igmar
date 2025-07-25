import { GameModel } from '../models/game.js'
import { PlayerGameModel } from '../models/player_game.js'
import { Types } from 'mongoose'
import { toObjectId } from '../utils/utils.js'
import { BattleshipService } from './battleship.service.js'
import { SimonSaysService } from './simon_says.service.js'
import { v4 as uuidv4 } from 'uuid'
import User from '../models/user.js'

export interface PlayerGameCreateInput {
  userId: number
  board?: string | null
  result?: 'win' | 'lose' | 'pending'
  shipsSunk?: number
  shipsLost?: number
  ready?: boolean
  customColors?: string[]
}

type CreateGameOptions = {
  userIds: number[]
  gameType: 'simonsay' | 'battleship'
  code: string
  customColors?: string[]
}

export default class GameService {
  private gameModel = new GameModel()
  private playerGameModel = new PlayerGameModel()
  private battleshipService: BattleshipService
  private simonSaysService: SimonSaysService

  constructor() {
    this.battleshipService = new BattleshipService()
    this.simonSaysService = new SimonSaysService()
  }

  // Métodos auxiliares
  async findByCode(code: string) {
    return this.gameModel.find_by_code(code)
  }

  async findById(id: string) {
    return this.gameModel.find_by_id(id)
  }

  // Métodos de lógica de negocio
  async joinGame(userId: number, code: string) {
    const game = await this.gameModel.find_one({ code, status: 'waiting' })
    if (!game) throw new Error('Partida no encontrada o no disponible para unirse')

    if (game.players.length >= 2) throw new Error('La partida ya tiene 2 jugadores')

    const playerGame = await this.playerGameModel.create({
      userId,
      gameId: game._id,
      board: undefined,
      result: 'pending',
      shipsSunk: 0,
      shipsLost: 0,
      ready: false,
    })

    game.players.push(playerGame._id)
    await this.gameModel.update_by_id(game._id.toString(), { players: game.players })

    return game
  }

  async updateStatusToStarted(gameId: string) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    game.status = 'started'
    await this.gameModel.update_by_id(gameId, game)

    return game
  }

  async createGame({ userIds, gameType, code, customColors }: CreateGameOptions) {
    if (gameType === 'battleship') {
      return this.battleshipService.createBattleshipGame({ userIds, code })
    } else if (gameType === 'simonsay') {
      return this.simonSaysService.createSimonGame({ userIds, code, customColors })
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }

  // Iniciar partida según tipo
  public async startGame(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    // Si ya está iniciada, devuelve el estado actual (idempotente)
    if (game.status === 'in_progress') {
      return { message: 'La partida ya fue iniciada', status: game.status }
    }

    if (game.status !== 'started') {
      throw new Error('La partida ya fue iniciada o finalizada')
    }

    if (!game.players || game.players.length < 2) {
      throw new Error('No hay suficientes jugadores para iniciar la partida')
    }

    const playerGames = await this.playerGameModel.find_many({ gameId: toObjectId(gameId) })

    const userInGame = playerGames.some((pg) => pg.userId === userId)
    if (!userInGame) {
      throw new Error('No perteneces a esta partida')
    }

    // Solo el host puede iniciar la partida
    const hostPlayerGameId = game.players[0].toString()
    const hostPlayerGame = playerGames.find((pg) => pg._id.toString() === hostPlayerGameId)
    if (!hostPlayerGame || hostPlayerGame.userId !== userId) {
      throw new Error('Solo el host puede iniciar la partida')
    }

    const allReady = playerGames.every((pg) => pg.ready)
    if (!allReady) {
      throw new Error('No todos los jugadores están listos')
    }

    if (game.gameType === 'battleship') {
      return this.battleshipService.startBattleshipGame(game, userId)
    } else {
      return this.simonSaysService.startSimonGame(game, userId)
    }
  }

  public async getGameStatus(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    // Aquí está el problema:
    // if (!['started', 'in_progress', 'finished'].includes(game.status)) {
    //   throw new Error('La partida no ha comenzado')
    // }

    // Solución: Permitir los nuevos estados SOLO para SimonSay
    const validSimonSayStatuses = [
      'started',
      'in_progress',
      'finished',
      'waiting_first_color',
      'repeating_sequence',
      'choosing_next_color',
    ]
    const validBattleshipStatuses = ['started', 'in_progress', 'finished']

    if (
      (game.gameType === 'simonsay' && !validSimonSayStatuses.includes(game.status)) ||
      (game.gameType === 'battleship' && !validBattleshipStatuses.includes(game.status))
    ) {
      throw new Error('La partida no ha comenzado')
    }

    if (!game.players || game.players.length === 0) {
      throw new Error('La partida no tiene jugadores')
    }

    const playerGames = await this.playerGameModel.find_many({ gameId: toObjectId(gameId) })

    const userInGame = playerGames.some((pg) => pg.userId === userId)
    if (!userInGame) throw new Error('No perteneces a esta partida')

    if (game.gameType === 'battleship') {
      return this.battleshipService.getBattleshipGameStatus(game, userId)
    } else if (game.gameType === 'simonsay') {
      return this.simonSaysService.getSimonGameStatus(game, userId)
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }

  public async getLobbyStatus(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Partida no encontrada')

    if (!game.players || game.players.length === 0) {
      throw new Error('La partida no tiene jugadores asignados')
    }

    const playerGames = await this.playerGameModel.find_many({ gameId: toObjectId(gameId) })

    const userInGame = playerGames.some((pg) => pg.userId === userId)
    if (!userInGame) throw new Error('No perteneces a esta partida')

    if (game.gameType === 'battleship') {
      return this.battleshipService.getBattleshipLobbyStatus(game, userId)
    } else if (game.gameType === 'simonsay') {
      return this.simonSaysService.getSimonLobbyStatus(game, userId)
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }

  async getGameWithPlayers(gameId: string) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    const playerDocs = await Promise.all(
      game.players.map(async (pId: any) => {
        const player = await this.playerGameModel.find_by_id(pId.toString())
        if (!player) throw new Error(`Jugador con id ${pId} no encontrado`)

        // Asignar user embebido dentro de cada player
        const user = await User.find(player.userId)
        if (!user) throw new Error(`Usuario con id ${player.userId} no encontrado`)

        return {
          ...player.toObject(),
          user: user.toJSON(),
        }
      })
    )

    return {
      ...game.toObject(),
      players: playerDocs,
    }
  }

  public async requestRematch(gameId: string, playerGameId: string) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    if (game.status !== 'finished') {
      throw new Error('Solo se puede solicitar revancha cuando la partida ha finalizado')
    }

    // Validar que el jugador sigue en la partida
    const isPlayerInGame = game.players.some((id) => id.toString() === playerGameId)
    if (!isPlayerInGame) {
      throw new Error('Ya no puedes pedir revancha: no estás en la partida')
    }

    // Validar que no haya pasado demasiado tiempo desde que terminó la partida
    const now = new Date()
    const finishedAt = game.updatedAt ?? game.createdAt ?? now
    const MAX_REMATCH_TIME_MS = 2 * 60 * 1000 // 2 minutos
    if (now.getTime() - finishedAt.getTime() > MAX_REMATCH_TIME_MS) {
      throw new Error(
        'Ya no puedes pedir revancha: ha pasado demasiado tiempo desde que terminó la partida'
      )
    }

    if (!game.rematchRequestedBy) {
      game.rematchRequestedBy = []
    }

    const alreadyRequested = game.rematchRequestedBy.some((id) => id.toString() === playerGameId)

    if (!alreadyRequested) {
      game.rematchRequestedBy.push(new Types.ObjectId(playerGameId))
      await this.gameModel.update_by_id(gameId, { rematchRequestedBy: game.rematchRequestedBy })
    }

    const allPlayerIds = game.players.map((id) => id.toString())
    const rematchIds = game.rematchRequestedBy.map((id) => id.toString())

    const bothAccepted = allPlayerIds.every((id) => rematchIds.includes(id))

    // Si ambos aceptaron, crea una nueva partida con los mismos jugadores
    if (bothAccepted) {
      // Obtener los userIds de los PlayerGame originales
      const playerGames = await this.playerGameModel.find_many({ gameId: toObjectId(gameId) })
      const userIds = playerGames.map((pg) => pg.userId)
      const newCode = uuidv4().substring(0, 8).toUpperCase()
      const createdGame = await this.createGame({
        userIds,
        gameType: game.gameType,
        code: newCode,
      })
      return { rematchStarted: true, gameId: createdGame.id }
    }

    return { rematchAcceptedBy: rematchIds, bothAccepted }
  }
  public async leaveGame(gameId: string, playerGameId: string) {
    const game = await this.gameModel.find_by_id(gameId)
    console.log('Leaving game:', gameId, 'PlayerGameId:', playerGameId)
    if (!game) throw new Error('Juego no encontrado')

    // Solo permite salir si la partida ya terminó
    if (game.status !== 'finished') {
      throw new Error('Solo puedes salir de la partida cuando ha finalizado')
    }

    // Verifica que el jugador esté en la partida
    const isPlayerInGame = game.players.some((id) => id.toString() === playerGameId)
    if (!isPlayerInGame) {
      throw new Error('Ya no estás en la partida')
    }

    // Quita al jugador del array de players
    game.players = game.players.filter((id) => id.toString() !== playerGameId)
    await this.gameModel.update_by_id(gameId, { players: game.players })

    // No borres el PlayerGame, así conservas historial

    return { left: true }
  }

  public async heartbeat(gameId: string) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    // Actualiza el timestamp de la última actividad
    game.updatedAt = new Date()
    await this.gameModel.update_by_id(gameId, { updatedAt: game.updatedAt })

    return { message: 'Heartbeat recibido' }
  }
}
