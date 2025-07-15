import { GameModel } from '../models/game.js'
import { PlayerGameModel } from '../models/player_game.js'
import { MoveModel } from '../models/battleship_move.js'
import User from '../models/user.js'
import Board from '@/Components/Board.vue'

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
    const finalCode = code

    console.log(gameType)
    const createdGame = await this.gameModel.create({
      code: finalCode,
      gameType: gameType,
      players: [],
      status: 'waiting',
      hasStarted: false,
      currentTurnUserId: null,
      ...(gameType === 'simonsay' && customColors ? { customColors } : {}),
    })

    console.log(createdGame)
    const playerGamesData = userIds.map((userId) => ({
      userId,
      gameId: createdGame._id,
      board: gameType === 'simonsay' ? undefined : [], // Cambié null por []
      result: gameType === 'simonsay' ? undefined : ('pending' as 'pending'),
      shipsSunk: gameType === 'simonsay' ? undefined : 0,
      shipsLost: gameType === 'simonsay' ? undefined : 0,
      ready: false,
      ...(gameType === 'simonsay' && customColors ? { customColors } : {}),
    }))
    console.log(playerGamesData)
    const createdPlayerGames = await Promise.all(
      playerGamesData.map((data) => this.playerGameModel.create(data))
    )

    createdGame.players = createdPlayerGames.map((pg) => pg._id)
    await this.gameModel.update_by_id(createdGame._id.toString(), createdGame)

    return {
      id: createdGame._id.toString(),
      code: createdGame.code,
    }
  }

  public async startGame(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    const playersResult = await Promise.all(
      game.players.map((pId) => this.playerGameModel.find_by_id(pId.toString()))
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
      await this.gameModel.update_by_id(gameId, {
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

  async getGameStatus(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    if (!['started', 'in_progress', 'finished'].includes(game.status)) {
      throw new Error('La partida no ha comenzado')
    }

    const playerDocs = await Promise.all(
      game.players.map(async (pId: any) => {
        const player = await this.playerGameModel.find_by_id(pId.toString())
        if (!player) throw new Error(`Jugador con id ${pId} no encontrado`)
        return player
      })
    )

    const me = playerDocs.find((p) => p.userId === userId)
    const opponent = playerDocs.find((p) => p.userId !== userId)

    if (!me) throw new Error('No perteneces a esta partida')
    if (!opponent) throw new Error('No hay oponente en la partida')

    // if (['started', 'in_progress'].includes(game.status) && opponent.lastSeenAt) {
    //   const inactiveLimit = new Date(Date.now() - 90 * 1000)
    //   if (opponent.lastSeenAt < inactiveLimit) {
    //     return this.declareVictory(gameId, me, opponent)
    //   }
    // }

    return {
      status: game.status,
      currentTurnUserId: game.currentTurnUserId,
      players: playerDocs.map((p) => ({
        userId: p.userId,
        ready: p.ready,
        shipsLost: p.shipsLost,
        shipsSunk: p.shipsSunk,
      })),
      myBoard: Array.isArray(me.board) ? me.board : me.board ? JSON.parse(me.board) : [],
      enemyBoard: this.maskEnemyBoard(
        Array.isArray(opponent.board)
          ? opponent.board
          : opponent.board
            ? JSON.parse(opponent.board)
            : []
      ),
    }
  }

  async getLobbyStatus(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Partida no encontrada')

    const playerDocs = await Promise.all(
      game.players.map(async (pId: any) => {
        const player = await this.playerGameModel.find_by_id(pId.toString())
        if (!player) throw new Error(`Jugador con id ${pId} no encontrado`)

        const user = await User.find(player.userId)
        if (!user) throw new Error(`Usuario con id ${player.userId} no encontrado`)

        return {
          userId: player.userId,
          ready: player.ready,
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

    const me = playerDocs.find((p) => p.userId === userId)
    if (!me) throw new Error('No perteneces a esta partida')

    const opponent = playerDocs.find((p) => p.userId !== userId)

    if (playerDocs.length < 2 || !opponent) {
      return {
        status: 'waiting',
        players: playerDocs,
        started: false,
      }
    }

    const bothReady = playerDocs.every((p) => p.ready)

    if (bothReady && game.status === 'waiting') {
      await this.gameModel.update_by_id(gameId, { status: 'started' })
      game.status = 'started'
    }

    return {
      status: game.status,
      players: playerDocs,
      started: game.status === 'started',
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
}
