import { GameModel } from '../models/game.js'
import { PlayerGameModel } from '../models/player_game.js'
import { Types } from 'mongoose'
import { toObjectId } from '../utils/utils.js'
import { BattleshipService } from './battleship.service.js'
import { SimonSaysService } from './simon_says.service.js'
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

  public async leaveGame(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    const playerGames = await this.playerGameModel.find_many({ gameId: new Types.ObjectId(gameId) })
    const leavingPlayer = playerGames.find((pg) => pg.userId === userId)
    const opponent = playerGames.find((pg) => pg.userId !== userId)

    if (!leavingPlayer) throw new Error('No perteneces a esta partida')

    console.log(`User ${userId} leaving game ${gameId}, status: ${game.status}`)

    // CASO 1: En lobby (waiting/started) - Solo quitar del juego
    if (['waiting', 'started'].includes(game.status)) {
      // Quitar del array de players
      game.players = game.players.filter((id) => id.toString() !== leavingPlayer._id.toString())
      await this.gameModel.update_by_id(gameId, { players: game.players })

      // Si queda solo 1 jugador, volver el juego a 'waiting'
      if (game.players.length === 1) {
        await this.gameModel.update_by_id(gameId, { status: 'waiting' })
      }

      return { left: true, message: 'Has salido del lobby' }
    }

    // CASO 2: En progreso - Declarar victoria al oponente
    if (['in_progress', 'waiting_first_color'].includes(game.status)) {
      if (!opponent) {
        // Si no hay oponente, solo terminar el juego
        game.status = 'finished'
        await this.gameModel.update_by_id(gameId, game)
        return { left: true, message: 'Partida terminada' }
      }

      // Declarar derrota al que se va y victoria al oponente
      leavingPlayer.result = 'lose'
      opponent.result = 'win'

      await this.playerGameModel.update_by_id(leavingPlayer._id.toString(), leavingPlayer)
      await this.playerGameModel.update_by_id(opponent._id.toString(), opponent)

      // Terminar el juego
      game.status = 'finished'
      game.winner = opponent.userId
      game.currentTurnUserId = null
      await this.gameModel.update_by_id(gameId, game)

      return {
        left: true,
        gameOver: true,
        winner: opponent.userId,
        message: 'Has abandonado. Victoria para el oponente',
      }
    }

    // CASO 3: Ya terminado - Solo quitar del juego
    if (game.status === 'finished') {
      game.players = game.players.filter((id) => id.toString() !== leavingPlayer._id.toString())
      await this.gameModel.update_by_id(gameId, { players: game.players })
      return { left: true, message: 'Has salido de la partida terminada' }
    }

    throw new Error('No puedes salir de la partida en este momento')
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
