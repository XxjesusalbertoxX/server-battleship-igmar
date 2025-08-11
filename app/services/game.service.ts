import { GameModel } from '#models/game'
import { PlayerGameModel } from '#models/player_game'
import { Types } from 'mongoose'
import { toObjectId } from '../utils/utils.js'
import { BattleshipService } from './battleship.service.js'
import { SimonSaysService } from './simon_says.service.js'
import { LoteriaService } from './loteria.service.js' // <-- agregar
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
  private loteriaService: LoteriaService

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

    // CORREGIDO: Validar estados según el tipo de juego específico
    if (game.gameType === 'battleship') {
      const validBattleshipStatuses = ['started', 'in_progress', 'finished']
      if (!validBattleshipStatuses.includes(game.status)) {
        throw new Error('La partida no ha comenzado')
      }
      // ...existing code...
    } else if (game.gameType === 'simonsay') {
      const validSimonSayStatuses = [
        'started',
        'choosing_first_color',
        'repeating_sequence',
        'choosing_next_color',
        'finished',
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

  // ...existing code...

  // ...existing code...

  public async leaveGame(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    if (game.gameType === 'loteria') {
      return this.handleLoteriaLeave(gameId, userId)
    }

    // Para otros tipos de juegos (battleship, simonsay)
    // Mantener lógica original si es necesario
    const player = await this.playerGameModel.find_one({
      userId,
      gameId: game._id,
    })
    if (!player) throw new Error('No perteneces a esta partida')

    await this.playerGameModel.delete_by_id(player._id.toString())
    return { message: 'Has abandonado la partida', gameEnded: false }
  }

  private async handleLoteriaLeave(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    const player = await this.playerGameModel.find_one({
      userId,
      gameId: game._id,
    })
    if (!player) throw new Error('No perteneces a esta partida')

    const userInfo = await User.find(userId)
    const playerName = userInfo?.name || 'Jugador desconocido'

    if ((player as any).isHost) {
      // SOLO EL ANFITRIÓN TERMINA LA PARTIDA
      await this.gameModel.update_by_id(gameId, {
        status: 'finished',
        winner: null, // Sin ganador por abandono del host
      })

      // Marcar a todos los jugadores como perdedores
      const allPlayers = await this.playerGameModel.find_many({ gameId: toObjectId(gameId) })
      for (const otherPlayer of allPlayers) {
        await this.playerGameModel.update_by_id(otherPlayer._id.toString(), {
          result: 'lose',
        })
      }

      return {
        message: `El anfitrión ${playerName} abandonó la partida. Juego terminado para todos.`,
        gameEnded: true,
      }
    } else {
      // JUGADOR NORMAL - SOLO CONVERTIR EN ESPECTADOR, NO TERMINAR PARTIDA
      await this.playerGameModel.update_by_id(player._id.toString(), {
        result: 'lose',
        isSpectator: true, // Convertir en espectador
      })

      // Agregar a lista de abandonados si no está ya
      const bannedPlayers = game.bannedPlayers || []
      const abandonedLabel = `${playerName} (abandonó)`
      if (!bannedPlayers.includes(abandonedLabel)) {
        bannedPlayers.push(abandonedLabel)
      }

      await this.gameModel.update_by_id(gameId, {
        bannedPlayers,
        // NO cambiar el status - mantener 'in_progress' si estaba en progreso
      })

      return {
        message: `${playerName} abandonó la partida y ahora es espectador. La partida continúa.`,
        gameEnded: false, // La partida NO termina
      }
    }
  }

  // ...existing code...

  public async heartbeat(_gameId: string) {
    return { alive: true }
  }

  // ...existing code...
}
