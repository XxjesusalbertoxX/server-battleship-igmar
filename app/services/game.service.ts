import { GameModel, GameDoc } from '../models/game.js'
import { PlayerGameModel } from '../models/player_game.js'
import { MoveModel } from '../models/battleship_move.js'
import User from '../models/user.js'
import { Types } from 'mongoose'

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
  private moveModel = new MoveModel()

  async joinGame(userId: number, code: string) {
    const game = await this.gameModel.find_one({ code, status: 'waiting' })
    if (!game) throw new Error('Partida no encontrada o no disponible para unirse')

    if (game.players.length >= 2) throw new Error('La partida ya tiene 2 jugadores')

    const playerGame = await this.playerGameModel.create({
      userId,
      gameId: game._id, // <--- Esto faltaba
      board: undefined, // ✅ Cambiado de null a undefined
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

  private generateRandomBoard(shipsCount: number): number[][] {
    const size = 8
    const board = Array(size)
      .fill(0)
      .map(() => Array(size).fill(0))
    let placed = 0
    while (placed < shipsCount) {
      const x = Math.floor(Math.random() * size)
      const y = Math.floor(Math.random() * size)
      if (board[x][y] === 0) {
        board[x][y] = 1
        placed++
      }
    }
    return board
  }

  async createGame({ userIds, gameType, code, customColors }: CreateGameOptions) {
    if (gameType === 'battleship') {
      return this.createBattleshipGame({ userIds, code })
    } else if (gameType === 'simonsay') {
      return this.createSimonGame({ userIds, code, customColors })
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }

  private async createBattleshipGame({ userIds, code }: { userIds: number[]; code: string }) {
    const createdGame = await this.gameModel.create({
      code,
      gameType: 'battleship',
      players: [],
      status: 'waiting',
      hasStarted: false,
      currentTurnUserId: null,
    })

    const playerGamesData = userIds.map((userId) => ({
      userId,
      gameId: createdGame._id,
      board: [],
      result: 'pending' as const,
      shipsSunk: 0,
      shipsLost: 0,
      ready: false,
    }))

    const createdPlayerGames = await Promise.all(
      playerGamesData.map((data) => this.playerGameModel.create(data))
    )

    createdGame.players = createdPlayerGames.map((pg) => pg._id)
    await this.gameModel.update_by_id(createdGame._id.toString(), createdGame)

    return { id: createdGame._id.toString(), code: createdGame.code }
  }

  private async createSimonGame({
    userIds,
    code,
    customColors,
  }: {
    userIds: number[]
    code: string
    customColors?: string[]
  }) {
    const createdGame = await this.gameModel.create({
      code,
      gameType: 'simonsay',
      players: [],
      status: 'waiting',
      hasStarted: false,
      currentTurnUserId: null,
      ...(customColors ? { customColors } : {}),
    })

    const playerGamesData = userIds.map((userId) => ({
      userId,
      gameId: createdGame._id,
      ready: false,
      ...(customColors ? { customColors } : {}),
    }))

    const createdPlayerGames = await Promise.all(
      playerGamesData.map((data) => this.playerGameModel.create(data))
    )

    createdGame.players = createdPlayerGames.map((pg) => pg._id)
    await this.gameModel.update_by_id(createdGame._id.toString(), createdGame)

    return { id: createdGame._id.toString(), code: createdGame.code }
  }

  // Iniciar partida según tipo
  public async startGame(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    if (game.gameType === 'battleship') {
      return this.startBattleshipGame(game, userId)
    } else {
      return this.startSimonGame(game, userId)
    }
  }

  // Inicio Battleship
  private async startBattleshipGame(game: any, userId: number) {
    const playersResult = await Promise.all(
      game.players.map((pId: Types.ObjectId) => this.playerGameModel.find_by_id(pId.toString()))
    )
    const players = playersResult.filter((p): p is NonNullable<typeof p> => !!p)

    // Generar tableros donde haga falta
    for (const pg of players) {
      if (!pg.board || (Array.isArray(pg.board) && pg.board.length === 0)) {
        pg.board = this.generateRandomBoard(15)
        await this.playerGameModel.update_by_id(pg._id.toString(), pg)
      }
    }

    // Asignar turno inicial y cambiar status
    if (!game.currentTurnUserId) {
      const randomPlayer = players[Math.floor(Math.random() * players.length)]!
      game.currentTurnUserId = randomPlayer.userId
      game.status = 'in_progress'
      await this.gameModel.update_by_id(game._id.toString(), {
        status: 'in_progress',
        currentTurnUserId: game.currentTurnUserId,
      })
    }

    // Devolver payload completo
    const me = players.find((p) => p.userId === userId)!
    const opponent = players.find((p) => p.userId !== userId)!
    return {
      gameId: game._id.toString(),
      currentTurnUserId: game.currentTurnUserId,
      myBoard: me.board!,
      enemyBoard: this.maskEnemyBoard(opponent.board!),
      status: game.status,
    }
  }

  // Inicio Simon Says
  private async startSimonGame(game: any, userId: number) {
    const playersResult = await Promise.all(
      game.players.map((pId: Types.ObjectId) => this.playerGameModel.find_by_id(pId.toString()))
    )
    const players = playersResult.filter((p): p is NonNullable<typeof p> => !!p)

    // Validar ready y colores
    const bothReady = players.every((p) => p.ready && p.customColors?.length === 6)
    if (!bothReady) {
      throw new Error('Ambos jugadores deben estar listos con colores definidos')
    }

    // Generar secuencia inicial
    if (!game.sequence || game.sequence.length === 0) {
      const randomPlayer = players[Math.floor(Math.random() * players.length)]!
      const randomColor =
        randomPlayer.customColors![Math.floor(Math.random() * randomPlayer.customColors!.length)]
      game.sequence = [randomColor]
      game.currentTurnUserId = randomPlayer.userId
      game.status = 'in_progress'
      await this.gameModel.update_by_id(game._id.toString(), game)
    }

    return {
      gameId: game._id.toString(),
      currentTurnUserId: game.currentTurnUserId,
      sequence: game.sequence,
      status: game.status,
    }
  }

  maskEnemyBoard(board: number[][]) {
    return board.map((row) => row.map((cell) => (cell === 1 ? 0 : cell)))
  }

  async attack(userId: number, gameId: string, x: number, y: number) {
    // 1️⃣ Obtener “me” y “opponent”
    const me: any = await this.playerGameModel.find_one({ userId, gameId })
    if (!me) throw new Error('Jugador no encontrado en la partida')

    const game: any = await this.gameModel.find_by_id(gameId)
    if (game.currentTurnUserId !== userId) throw new Error('No es tu turno')

    const opponentId = game.players.find((p: any) => p.toString() !== me._id.toString())
    const opponent: any = await this.playerGameModel.find_by_id(opponentId.toString())
    if (!opponent) throw new Error('Oponente no encontrado')

    // 2️⃣ Asegurarnos de trabajar siempre con un array 8×8
    const board: number[][] = Array.isArray(opponent.board)
      ? opponent.board
      : opponent.board
        ? JSON.parse(opponent.board)
        : Array(8)
            .fill(0)
            .map(() => Array(8).fill(0))

    if (board[x][y] >= 2) throw new Error('Casilla ya atacada')

    // 3️⃣ Marcar hit o miss
    const wasHit = board[x][y] === 1
    board[x][y] += 2 // 0→2 (miss), 1→3 (hit)

    // 4️⃣ Actualizar contadores
    if (wasHit) {
      me.shipsSunk = (me.shipsSunk ?? 0) + 1
      opponent.shipsLost = (opponent.shipsLost ?? 0) + 1
    }

    // 5️⃣ Guardar el move y **el tablero** actualizado
    await this.moveModel.create({ playerGameId: me._id, x, y, hit: wasHit })

    // ▪️ Guardamos tablero como array para simplificar el parseo en getGameStatus
    opponent.board = board as any
    await this.playerGameModel.update_by_id(opponent._id.toString(), opponent)
    await this.playerGameModel.update_by_id(me._id.toString(), me)

    // 6️⃣ Si no quedan barcos enemigos, declaramos victoria
    if (!board.flat().includes(1)) {
      return this.declareVictory(gameId, me, opponent)
    }

    // 7️⃣ Sólo cambiamos el turno si fue “miss”
    if (!wasHit) {
      await this.gameModel.update_by_id(gameId, { currentTurnUserId: opponent.userId })
    }

    return { status: wasHit ? 'hit' : 'miss', x, y }
  }

  async declareVictory(gameId: string, winner: any, loser: any) {
    winner.result = 'win'
    loser.result = 'lose'

    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')
    game.status = 'finished'
    game.currentTurnUserId = null

    await this.playerGameModel.update_by_id(winner._id.toString(), winner)
    await this.playerGameModel.update_by_id(loser._id.toString(), loser)
    await this.gameModel.update_by_id(gameId, game)

    return { status: 'win', message: '¡Has ganado la partida!' }
  }

  public async getGameStatus(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    if (!['started', 'in_progress', 'finished'].includes(game.status)) {
      throw new Error('La partida no ha comenzado')
    }

    if (game.gameType === 'battleship') {
      return this.getBattleshipGameStatus(game, userId)
    } else if (game.gameType === 'simonsay') {
      return this.getSimonGameStatus(game, userId)
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }

  private async getBattleshipGameStatus(game: GameDoc, userId: number) {
    const playerDocs = await Promise.all(
      game.players.map((pId: any) => this.playerGameModel.find_by_id(pId.toString()))
    )

    const players = playerDocs.filter(Boolean)
    const me = players.find((p) => p!.userId === userId)
    const opponent = players.find((p) => p!.userId !== userId)

    if (!me) throw new Error('No perteneces a esta partida')
    if (!opponent) throw new Error('No hay oponente en la partida')

    return {
      status: game.status,
      currentTurnUserId: game.currentTurnUserId,
      players: players.map((p) => ({
        userId: p!.userId,
        ready: p!.ready,
        shipsLost: p!.shipsLost,
        shipsSunk: p!.shipsSunk,
      })),
      myBoard: Array.isArray(me!.board) ? me!.board : [],
      enemyBoard: this.maskEnemyBoard(Array.isArray(opponent!.board) ? opponent!.board : []),
    }
  }

  private async getSimonGameStatus(game: GameDoc, userId: number) {
    const playerDocs = await Promise.all(
      game.players.map((pId: any) => this.playerGameModel.find_by_id(pId.toString()))
    )

    const players = playerDocs.filter(Boolean)
    const me = players.find((p) => p!.userId === userId)
    const opponent = players.find((p) => p!.userId !== userId)

    if (!me) throw new Error('No perteneces a esta partida')
    if (!opponent) throw new Error('No hay oponente en la partida')

    return {
      status: game.status,
      currentTurnUserId: game.currentTurnUserId,
      players: players.map((p) => ({
        userId: p!.userId,
        ready: p!.ready,
        customColors: p!.customColors,
      })),
      sequence: game.sequence ?? [],
      lastChosenColor: game.lastChosenColor ?? null,
    }
  }

  public async getLobbyStatus(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Partida no encontrada')

    if (game.gameType === 'battleship') {
      return this.getBattleshipLobbyStatus(game, userId)
    } else if (game.gameType === 'simonsay') {
      return this.getSimonLobbyStatus(game, userId)
    } else {
      throw new Error('Tipo de juego no soportado')
    }
  }

  private async getBattleshipLobbyStatus(game: GameDoc, userId: number) {
    const playerDocs = await this.getPlayerLobbyData(game)

    this.verifyPlayerInGame(playerDocs, userId)

    const bothReady = playerDocs.every((p) => p.ready)
    if (bothReady && game.status === 'waiting') {
      await this.gameModel.update_by_id(game._id.toString(), { status: 'started' })
      game.status = 'started'
    }

    return {
      status: game.status,
      players: playerDocs,
      started: game.status === 'started',
    }
  }

  private async getSimonLobbyStatus(game: GameDoc, userId: number) {
    const playerDocs = await this.getPlayerLobbyData(game)

    this.verifyPlayerInGame(playerDocs, userId)

    const bothReady = playerDocs.every((p) => p.ready)
    const bothHaveColors =
      game.players.length === 2 && playerDocs.every((p) => p.customColors?.length === 6)

    if (bothReady && bothHaveColors && game.status === 'waiting') {
      await this.gameModel.update_by_id(game._id.toString(), { status: 'started' })
      game.status = 'started'
    }

    return {
      status: game.status,
      players: playerDocs.map((p) => ({
        ...p,
        customColorsChosen: p.customColors?.length === 6,
      })),
      started: game.status === 'started',
    }
  }

  private async getPlayerLobbyData(game: GameDoc) {
    return Promise.all(
      game.players.map(async (pId: any) => {
        const player = await this.playerGameModel.find_by_id(pId.toString())
        if (!player) throw new Error(`Jugador con id ${pId} no encontrado`)

        const user = await User.find(player.userId)
        if (!user) throw new Error(`Usuario con id ${player.userId} no encontrado`)

        return {
          userId: player.userId,
          ready: player.ready,
          customColors: player.customColors,
          user: {
            id: user.id,
            name: user.name,
            wins: user.wins,
            losses: user.losses,
            level: user.level,
          },
        }
      })
    )
  }

  private verifyPlayerInGame(playerDocs: any[], userId: number) {
    const me = playerDocs.find((p) => p.userId === userId)
    if (!me) throw new Error('No perteneces a esta partida')
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
}
