import { GameModel } from '#models/game'
import { PlayerGameModel } from '#models/player_game'
import { MoveModel } from '../models/battleship_move.js'
import UserService from '#services/user.service'
import User from '../models/user.js'

const TOTAL_SHIPS = 15

export class BattleshipService {
  private playerGameModel = PlayerGameModel.battleship
  private userService = new UserService()
  private moveModel = new MoveModel()

  private generateRandomBoard(shipsCount: number): number[][] {
    const size = 8
    const board = Array(size)
      .fill(null)
      .map(() => Array(size).fill(0)) // <-- usar null en fill() para evitar referencia compartida

    let placed = 0
    let attempts = 0
    const maxAttempts = shipsCount * 10 // Evitar bucle infinito

    while (placed < shipsCount && attempts < maxAttempts) {
      const x = Math.floor(Math.random() * size)
      const y = Math.floor(Math.random() * size)

      if (board[x][y] === 0) {
        board[x][y] = 1 // Colocar barco
        placed++
      }
      attempts++
    }

    return board
  }

  async createBattleshipGame({ userIds, code }: { userIds: number[]; code: string }) {
    const createdGame = await GameModel.createGame('battleship', {
      code,
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
      playerGamesData.map((data) => PlayerGameModel.createPlayer('battleship', data))
    )

    createdGame.players = createdPlayerGames.map((pg) => pg._id)
    await GameModel.update_by_id(createdGame._id.toString(), createdGame)

    return { id: createdGame._id.toString(), code: createdGame.code }
  }

  async startBattleshipGame(game: any, userId: number) {
    const players = await this.playerGameModel.findByGameId(game._id.toString())

    // Generar tableros donde haga falta
    for (const pg of players) {
      // Verificar si el tablero está vacío o no existe
      const needsBoard =
        !pg.board ||
        (Array.isArray(pg.board) && pg.board.length === 0) ||
        (Array.isArray(pg.board) && pg.board.every((row) => row.every((cell) => cell === 0)))

      if (needsBoard) {
        pg.board = this.generateRandomBoard(TOTAL_SHIPS)

        // Asegurar que se guarde correctamente
        await this.playerGameModel.updateBoard(pg._id.toString(), pg.board)
      } else {
      }
    }

    // Verificar que ambos jugadores tengan tableros válidos
    const updatedPlayers = await this.playerGameModel.findByGameId(game._id.toString())
    for (const player of updatedPlayers) {
      const shipCount = player.board?.flat().filter((cell) => cell === 1).length || 0

      if (shipCount === 0) {
        // Forzar regeneración
        player.board = this.generateRandomBoard(TOTAL_SHIPS)
        await this.playerGameModel.updateBoard(player._id.toString(), player.board)
      }
    }

    // Asignar turno inicial y cambiar status
    if (!game.currentTurnUserId) {
      const randomPlayer = players[Math.floor(Math.random() * players.length)]!
      game.currentTurnUserId = randomPlayer.userId
      game.status = 'in_progress'
      await GameModel.update_by_id(game._id.toString(), {
        status: 'in_progress',
        currentTurnUserId: game.currentTurnUserId,
      })
    }

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
    const players = await this.playerGameModel.findByGameId(gameId)
    const me = players.find((p) => p.userId === userId)
    if (!me) throw new Error('Jugador no encontrado en la partida')

    const game: any = await GameModel.find_by_id(gameId)
    if (game.currentTurnUserId !== userId) throw new Error('No es tu turno')

    const opponent = players.find((p) => p.userId !== userId)
    if (!opponent) throw new Error('Oponente no encontrado')

    const board: number[][] = Array.isArray(opponent.board)
      ? opponent.board
      : opponent.board
        ? JSON.parse(opponent.board)
        : Array(8)
            .fill(0)
            .map(() => Array(8).fill(0))

    if (board[x][y] >= 2) throw new Error('Casilla ya atacada')
    const wasHit = board[x][y] === 1
    board[x][y] += 2

    if (wasHit) {
      me.shipsSunk = (me.shipsSunk ?? 0) + 1
      opponent.shipsLost = (opponent.shipsLost ?? 0) + 1
    }

    await this.moveModel.create({ playerGameId: me._id, x, y, hit: wasHit })
    await this.playerGameModel.updateBoard(opponent._id.toString(), board)
    await this.playerGameModel.update_by_id(me._id.toString(), me)

    if (!board.flat().includes(1)) {
      return this.declareVictory(gameId, me, opponent)
    }

    if (!wasHit) {
      await GameModel.update_by_id(gameId, { currentTurnUserId: opponent.userId })
    }

    return { status: wasHit ? 'hit' : 'miss', x, y }
  }

  async declareVictory(gameId: string, winner: any, loser: any) {
    winner.result = 'win'
    loser.result = 'lose'

    const game = await GameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    game.status = 'finished'
    game.currentTurnUserId = null
    game.winner = winner.userId

    await this.playerGameModel.update_by_id(winner._id.toString(), winner)
    await this.playerGameModel.update_by_id(loser._id.toString(), loser)
    await GameModel.update_by_id(gameId, game)

    try {
      await this.userService.grantWinExperience(winner.userId)
      await this.userService.grantLossExperience(loser.userId)
    } catch (error) {
      console.error('Error otorgando experiencia:', error)
    }

    return { status: 'win', message: '¡Has ganado la partida!' }
  }

  async getBattleshipGameStatus(game: any, userId: number) {
    const players = await this.playerGameModel.findByGameId(game._id.toString())
    const me = players.find((p) => p.userId === userId)
    const opponent = players.find((p) => p.userId !== userId)

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
    function countShips(board: number[][]): number {
      return board.flat().filter((cell) => cell === 1).length
    }

    const users = await Promise.all(players.map((p) => User.find(p.userId)))
    const myShipsRemaining = countShips(me.board)
    const enemyShipsRemaining = countShips(opponent.board)

    return {
      status: game.status,
      currentTurnUserId: game.currentTurnUserId,
      players: players.map((p, idx) => ({
        userId: p.userId,
        ready: p.ready,
        shipsLost: p.shipsLost,
        shipsSunk: p.shipsSunk,
        board: Array.isArray(p.board) ? p.board : [],
        user: users[idx]
          ? {
              id: users[idx].id,
              name: users[idx].name,
              wins: users[idx].wins,
              losses: users[idx].losses,
              level: users[idx].level,
              exp: users[idx].exp,
            }
          : undefined,
      })),
      myBoard: Array.isArray(me.board) ? me.board : [],
      enemyBoard: this.maskEnemyBoard(Array.isArray(opponent.board) ? opponent.board : []),
      myShipsRemaining,
      enemyShipsRemaining,
    }
  }

  async getBattleshipLobbyStatus(game: any, userId: number) {
    const playerDocs = await this.getPlayerLobbyData(game)
    this.verifyPlayerInGame(playerDocs, userId)

    const bothReady = playerDocs.every((p) => p.ready)
    if (bothReady && game.status === 'waiting') {
      await GameModel.update_by_id(game._id.toString(), { status: 'started' })
      game.status = 'started'
    }

    return {
      status: game.status,
      players: playerDocs,
      started: game.status === 'started',
    }
  }

  // LIMPIO - Solo campos de Battleship
  private async getPlayerLobbyData(game: any) {
    const players = await this.playerGameModel.findByGameId(game._id.toString())

    return Promise.all(
      players.map(async (player) => {
        const user = await User.find(player.userId)
        if (!user) throw new Error(`Usuario con id ${player.userId} no encontrado`)

        return {
          _id: player._id.toString(),
          userId: player.userId,
          ready: player.ready,
          // SOLO campos específicos de Battleship
          board: Array.isArray(player.board) ? player.board : [],
          shipsSunk: player.shipsSunk || 0,
          shipsLost: player.shipsLost || 0,
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
    const game = await GameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')
    if (game.status === 'finished') throw new Error('La partida ya terminó')

    const players = await this.playerGameModel.findByGameId(gameId)
    const loser = players.find((pg) => pg.userId === surrenderingPlayerId)
    const winner = players.find((pg) => pg.userId !== surrenderingPlayerId)

    if (!loser || !winner) throw new Error('Jugadores no encontrados')

    loser.result = 'lose'
    winner.result = 'win'
    await this.playerGameModel.update_by_id(loser._id.toString(), loser)
    await this.playerGameModel.update_by_id(winner._id.toString(), winner)

    game.status = 'finished'
    game.currentTurnUserId = null
    await GameModel.update_by_id(gameId, game)

    try {
      await this.userService.grantWinExperience(winner.userId)
      await this.userService.grantLossExperience(loser.userId)
    } catch (error) {
      console.error('Error otorgando experiencia:', error)
    }

    return { status: 'finished', winner: winner.userId, loser: loser.userId }
  }
}
