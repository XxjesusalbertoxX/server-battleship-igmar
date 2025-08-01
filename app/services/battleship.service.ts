import { GameModel, GameDoc } from '../models/game.js'
import { PlayerGameModel, PlayerGameDoc } from '../models/player_game.js'
import { MoveModel } from '../models/battleship_move.js'
import UserService from '#services/user.service'
import User from '../models/user.js'
import { Types } from 'mongoose'
const TOTAL_SHIPS = 15

export class BattleshipService {
  private gameModel = new GameModel()
  private playerGameModel = new PlayerGameModel()
  private userService = new UserService()
  private moveModel = new MoveModel()

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

  async createBattleshipGame({ userIds, code }: { userIds: number[]; code: string }) {
    const createdGame = await this.gameModel.create({
      code,
      gameType: 'battleship',
      players: [],
      status: 'waiting',
      hasStarted: false,
      currentTurnUserId: null,
      surrenderedBy: [],
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

  async startBattleshipGame(game: any, userId: number) {
    const playersResult = await Promise.all(
      game.players.map((pId: Types.ObjectId) => this.playerGameModel.find_by_id(pId.toString()))
    )
    const players = playersResult.filter((p): p is NonNullable<typeof p> => !!p)

    // Generar tableros donde haga falta
    for (const pg of players) {
      if (!pg.board || (Array.isArray(pg.board) && pg.board.length === 0)) {
        pg.board = this.generateRandomBoard(TOTAL_SHIPS)
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

  maskEnemyBoard(board: number[][]) {
    return board.map((row) => row.map((cell) => (cell === 1 ? 0 : cell)))
  }

  async attack(userId: number, gameId: string, x: number, y: number) {
    // 1️⃣ Obtener "me" y "opponent"
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

    // 7️⃣ Sólo cambiamos el turno si fue "miss"
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
    game.winner = winner.userId

    await this.playerGameModel.update_by_id(winner._id.toString(), winner)
    await this.playerGameModel.update_by_id(loser._id.toString(), loser)
    await this.gameModel.update_by_id(gameId, game)

    // NUEVO: Otorgar experiencia
    try {
      await this.userService.grantWinExperience(winner.userId)
      await this.userService.grantLossExperience(loser.userId)
    } catch (error) {
      console.error('Error otorgando experiencia:', error)
    }

    return { status: 'win', message: '¡Has ganado la partida!' }
  }

  async getBattleshipGameStatus(game: GameDoc, userId: number) {
    // Obtener todos los playerGame docs
    const playerDocs = await Promise.all(
      game.players.map(async (pId: any) => {
        try {
          return await this.playerGameModel.find_by_id(pId.toString())
        } catch {
          return null
        }
      })
    )

    const players = playerDocs.filter(Boolean) as PlayerGameDoc[]
    const me = players.find((p) => p.userId === userId)!
    const opponent = players.find((p) => p.userId !== userId)!

    if (!me || !opponent) {
      throw new Error('No perteneces a esta partida o no hay oponente')
    }

    if (game.status === 'finished') {
      const winnerPg = players.find((p) => p.result === 'win')!
      const loserPg = players.find((p) => p.result === 'lose')!

      const winnerUser = await User.find(winnerPg.userId)
      const loserUser = await User.find(loserPg.userId)

      return {
        status: 'finished',
        winnerName: winnerUser?.name || 'Desconocido',
        loserName: loserUser?.name || 'Desconocido',
        myBoard: Array.isArray(me.board) ? me.board : [],
        enemyBoard: Array.isArray(opponent.board) ? opponent.board : [],
      }
    }

    const users = await Promise.all(players.map((p) => User.find(p.userId)))
    if (!me || !opponent) {
      throw new Error('No perteneces a esta partida o no hay oponente')
    }

    // Obtén los barcos restantes usando shipsLost
    const myShipsRemaining = TOTAL_SHIPS - (me.shipsLost ?? 0)
    const enemyShipsRemaining = TOTAL_SHIPS - (opponent.shipsLost ?? 0)

    return {
      status: game.status,
      currentTurnUserId: game.currentTurnUserId,
      players: players.map((p, idx) => ({
        userId: p.userId,
        ready: p.ready,
        shipsLost: p.shipsLost,
        shipsSunk: p.shipsSunk,
        user: users[idx]
          ? {
              id: users[idx].id,
              name: users[idx].name,
              wins: users[idx].wins,
              losses: users[idx].losses,
              level: users[idx].level,
            }
          : undefined,
      })),
      myBoard: Array.isArray(me.board) ? me.board : [],
      enemyBoard: this.maskEnemyBoard(Array.isArray(opponent.board) ? opponent.board : []),
      myShipsRemaining,
      enemyShipsRemaining,
    }
  }

  async getBattleshipLobbyStatus(game: GameDoc, userId: number) {
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

  // Método auxiliar compartido
  private async getPlayerLobbyData(game: GameDoc) {
    return Promise.all(
      game.players.map(async (pId: any) => {
        const player = await this.playerGameModel.find_by_id(pId.toString())
        if (!player) throw new Error(`Jugador con id ${pId} no encontrado`)

        const user = await User.find(player.userId)
        if (!user) throw new Error(`Usuario con id ${player.userId} no encontrado`)

        return {
          _id: player._id.toString(),
          userId: player.userId,
          ready: player.ready,
          customColors: player.customColors,
          user: {
            id: user.id,
            name: user.name,
            wins: user.wins,
            losses: user.losses,
            level: user.level,
            exp: user.exp,
          },
        }
      })
    )
  }

  private verifyPlayerInGame(playerDocs: any[], userId: number) {
    const me = playerDocs.find((p) => p.userId === userId)
    if (!me) throw new Error('No perteneces a esta partida')
  }

  async surrenderGame(gameId: string, surrenderingPlayerId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')
    if (game.status === 'finished') throw new Error('La partida ya terminó')

    const playerGames = await this.playerGameModel.find_many({ gameId: new Types.ObjectId(gameId) })
    const loser = playerGames.find((pg) => pg.userId === surrenderingPlayerId)
    const winner = playerGames.find((pg) => pg.userId !== surrenderingPlayerId)

    if (!loser || !winner) throw new Error('Jugadores no encontrados')

    loser.result = 'lose'
    winner.result = 'win'
    await this.playerGameModel.update_by_id(loser._id.toString(), loser)
    await this.playerGameModel.update_by_id(winner._id.toString(), winner)

    game.status = 'finished'
    game.currentTurnUserId = null
    await this.gameModel.update_by_id(gameId, game)

    return { status: 'finished', winner: winner.userId, loser: loser.userId }
  }
}
