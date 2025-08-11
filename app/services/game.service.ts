import { GameModel } from '#models/game'
import { PlayerGameModel } from '#models/player_game'
import type { GameLoteriaDoc } from '#models/loteria/game_loteria'
import { Types } from 'mongoose'
import { toObjectId } from '../utils/utils.js'
import { BattleshipService } from './battleship.service.js'
import { SimonSaysService } from './simon_says.service.js'
import { LoteriaService } from './loteria.service.js' // <-- agregar
import UserService from '#services/user.service'
import User from '../models/user.js'
import { GameSimonSayDoc } from '#models/simonsay/game_simon_say'

export interface PlayerGameCreateInput {
  userId: number
  gameType: 'battleship' | 'simonsay' | 'loteria' // <-- agregar loteria
  gameId: Types.ObjectId
  board?: number[][]
  result?: 'win' | 'lose' | 'pending'
  shipsSunk?: number
  shipsLost?: number
  ready?: boolean
  customColors?: string[]
  sequence?: string[]
  currentSequenceIndex?: number
  // Campos específicos de lotería
  playerCard?: string[]
  markedCells?: boolean[]
  tokensUsed?: number
  totalTokens?: number
  isHost?: boolean
  isSpectator?: boolean
  cardGenerated?: boolean
}

type CreateGameOptions = {
  userIds: number[]
  gameType: 'simonsay' | 'battleship' | 'loteria' // <-- agregar loteria
  code: string
  customColors?: string[]
  // Campos específicos de lotería
  minPlayers?: number
  maxPlayers?: number
}

export default class GameService {
  private gameModel = GameModel.base
  private playerGameModel = PlayerGameModel.base
  private battleshipService: BattleshipService
  private simonSaysService: SimonSaysService
  private loteriaService: LoteriaService // <-- agregar
  private userService = new UserService()

  constructor() {
    this.battleshipService = new BattleshipService()
    this.simonSaysService = new SimonSaysService()
    this.loteriaService = new LoteriaService() // <-- agregar
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

    // Para lotería, usar su servicio específico
    if (game.gameType === 'loteria') {
      return this.loteriaService.joinLoteriaGame(userId, code)
    }

    // Para otros juegos (battleship, simonsay)
    if (game.players.length >= 2) throw new Error('La partida ya tiene 2 jugadores')

    // CORREGIDO: Usar el factory method según el tipo de juego
    const playerGame = await PlayerGameModel.createPlayer(game.gameType, {
      userId,
      gameId: game._id,
      result: 'pending',
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

  async createGame({
    userIds,
    gameType,
    code,
    customColors,
    minPlayers,
    maxPlayers,
  }: CreateGameOptions) {
    if (gameType === 'battleship') {
      return this.battleshipService.createBattleshipGame({ userIds, code })
    } else if (gameType === 'simonsay') {
      return this.simonSaysService.createSimonGame({
        userIds,
        code,
        availableColors: customColors || [], // CORREGIDO: usar customColors
      })
    } else if (gameType === 'loteria') {
      // Para lotería, validar que se pasen los parámetros necesarios
      if (!minPlayers || !maxPlayers) {
        throw new Error('Para lotería se requieren minPlayers y maxPlayers')
      }
      return this.loteriaService.createLoteriaGame({ userIds, code, minPlayers, maxPlayers })
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }

  // Iniciar partida según tipo
  public async startGame(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    // Para lotería, usar su servicio específico
    if (game.gameType === 'loteria') {
      return this.loteriaService.startLoteriaGame(game, userId)
    }

    // Para otros juegos (battleship, simonsay)
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
      return this.simonSaysService.startSimonGame(game as unknown as GameSimonSayDoc, userId)
    }
  }

  public async getGameStatus(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    // Para lotería, usar su servicio específico
    if (game.gameType === 'loteria') {
      return this.loteriaService.getLoteriaGameStatus(game, userId)
    }

    // Para otros juegos (battleship, simonsay)
    // CORREGIDO: Validar estados según el tipo de juego específico
    if (game.gameType === 'battleship') {
      const validBattleshipStatuses = ['started', 'in_progress', 'finished']
      if (!validBattleshipStatuses.includes(game.status)) {
        throw new Error('La partida no ha comenzado')
      }
    } else if (game.gameType === 'simonsay') {
      const validSimonSayStatuses = [
        'started',
        'in_progress',
        'finished',
        'waiting_first_color',
        'repeating_sequence',
        'choosing_next_color',
      ]
      if (!validSimonSayStatuses.includes(game.status)) {
        throw new Error('La partida no ha comenzado')
      }
    }

    if (!game.players || game.players.length === 0) {
      throw new Error('La partida no tiene jugadores')
    }

    const playerGames = await this.playerGameModel.find_many({ gameId: toObjectId(gameId) })

    const userInGame = playerGames.some((pg) => pg.userId === userId)

    // CORREGIDO: Permitir ver el status final aunque ya no esté en playerGames
    if (!userInGame) {
      if (game.status === 'finished') {
        // Buscar si fue el ganador o perdedor
        const isWinner = game.winner === userId
        return {
          status: 'finished',
          result: isWinner ? 'win' : 'lose',
          winnerName: isWinner ? 'Tú' : 'Oponente',
          loserName: isWinner ? 'Oponente' : 'Tú',
          message: isWinner
            ? '¡Ganaste! El oponente abandonó la partida.'
            : 'Perdiste la partida o la abandonaste.',
        }
      }
      throw new Error('No perteneces a esta partida o no hay oponente')
    }

    if (game.gameType === 'battleship') {
      return this.battleshipService.getBattleshipGameStatus(game, userId)
    } else if (game.gameType === 'simonsay') {
      return this.simonSaysService.getSimonGameStatus(game as unknown as GameSimonSayDoc, userId)
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }

  public async getLobbyStatus(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Partida no encontrada')

    // Para lotería, usar su servicio específico
    if (game.gameType === 'loteria') {
      return this.loteriaService.getLoteriaLobbyStatus(game, userId)
    }

    // Para otros juegos (battleship, simonsay)
    if (!game.players || game.players.length === 0) {
      throw new Error('La partida no tiene jugadores asignados')
    }

    const playerGames = await this.playerGameModel.find_many({ gameId: toObjectId(gameId) })

    const userInGame = playerGames.some((pg) => pg.userId === userId)
    if (!userInGame) throw new Error('No perteneces a esta partida')

    if (game.gameType === 'battleship') {
      return this.battleshipService.getBattleshipLobbyStatus(game, userId)
    } else if (game.gameType === 'simonsay') {
      return this.simonSaysService.getSimonLobbyStatus(game as unknown as GameSimonSayDoc, userId)
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

    // CASO 1: En lobby (waiting/started/card_selection/ready_check)
    const lobbyStatuses = ['waiting', 'started', 'card_selection', 'ready_check']
    if (lobbyStatuses.includes(game.status)) {
      // Quitar del array de players
      game.players = game.players.filter((id) => id.toString() !== leavingPlayer._id.toString())
      await this.gameModel.update_by_id(gameId, { players: game.players })

      // NOTA: NO borrar el PlayerGame para mantener historial
      // Solo actualizar su estado si es necesario

      if (game.players.length === 0) {
        // Si ya no hay jugadores, borrar el Game
        await this.gameModel.delete_by_id(gameId)
        return { left: true, message: 'Has salido y la partida fue eliminada (sin jugadores)' }
      } else {
        // Para lotería, si queda al menos el anfitrión, volver a waiting
        if (game.gameType === 'loteria') {
          await this.gameModel.update_by_id(gameId, { status: 'waiting' })
        } else if (game.players.length === 1) {
          // Para otros juegos, volver a waiting si queda solo 1 jugador
          await this.gameModel.update_by_id(gameId, { status: 'waiting' })
        }
      }

      return { left: true, message: 'Has salido del lobby' }
    }

    // CASO 2: En progreso - Declarar victoria al oponente (o continuar si es lotería con más jugadores)
    const progressStatuses = [
      'in_progress',
      'waiting_first_color',
      'repeating_sequence',
      'choosing_next_color',
      'verification', // Estado específico de lotería
    ]
    if (progressStatuses.includes(game.status)) {
      // Para lotería con múltiples jugadores
      if (game.gameType === 'loteria') {
        const loteriaGame = game as unknown as GameLoteriaDoc
        // Marcar al jugador como perdedor y en modo espectador
        leavingPlayer.result = 'lose'
        // Si el modelo de lotería tiene isSpectator, usarlo
        await this.playerGameModel.update_by_id(leavingPlayer._id.toString(), leavingPlayer)

        // Quitar del array de players
        game.players = game.players.filter((id) => id.toString() !== leavingPlayer._id.toString())
        await this.gameModel.update_by_id(gameId, { players: game.players })

        // Si era el anfitrión, terminar el juego
        if ((leavingPlayer as any).isHost) {
          await this.gameModel.update_by_id(gameId, { status: 'finished' })
          return {
            left: true,
            gameOver: true,
            message: 'El anfitrión abandonó. Partida terminada.',
          }
        }

        // Si quedan jugadores suficientes, continuar
        if (game.players.length >= loteriaGame.minPlayers) {
          return { left: true, message: 'Has abandonado. El juego continúa.' }
        } else {
          // No hay suficientes jugadores, terminar
          await this.gameModel.update_by_id(gameId, { status: 'finished' })
          return {
            left: true,
            gameOver: true,
            message: 'No hay suficientes jugadores. Partida terminada.',
          }
        }
      }

      // Para juegos de 2 jugadores (battleship, simonsay)
      if (!opponent) {
        game.status = 'finished'
        game.winner = null
        await this.gameModel.update_by_id(gameId, game)
        return { left: true, message: 'Partida terminada' }
      }

      leavingPlayer.result = 'lose'
      opponent.result = 'win'
      await this.playerGameModel.update_by_id(leavingPlayer._id.toString(), leavingPlayer)
      await this.playerGameModel.update_by_id(opponent._id.toString(), opponent)

      try {
        await this.userService.grantWinExperience(opponent.userId)
        await this.userService.grantLossExperience(userId)
      } catch (error) {
        console.error('Error otorgando experiencia:', error)
      }

      // Quitar del array de players
      game.players = game.players.filter((id) => id.toString() !== leavingPlayer._id.toString())
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
      // Quitar del array de players
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
