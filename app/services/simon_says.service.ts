import { GameModel, GameDoc } from '../models/game.js'
import { PlayerGameModel } from '../models/player_game.js'
import User from '../models/user.js'
import { Types } from 'mongoose'

export class SimonSaysService {
  private gameModel = new GameModel()
  private playerGameModel = new PlayerGameModel()

  async createSimonGame({
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
      surrenderedBy: [],
      // Sin secuencia global
    })

    const playerGamesData = userIds.map((userId) => ({
      userId,
      gameId: createdGame._id,
      ready: false,
      customColors: customColors || [],
      sequence: [], // Secuencia individual del jugador
    }))

    const createdPlayerGames = await Promise.all(
      playerGamesData.map((data) => this.playerGameModel.create(data))
    )

    createdGame.players = createdPlayerGames.map((pg) => pg._id)
    await this.gameModel.update_by_id(createdGame._id.toString(), createdGame)

    return { id: createdGame._id.toString(), code: createdGame.code }
  }

  // Establecer colores personalizados de un jugador
  async setColors(gameId: string, userId: number, colors: string[]) {
    if (!colors || colors.length !== 6) {
      throw new Error('Debes escoger exactamente 6 colores')
    }

    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')
    if (game.status !== 'waiting') throw new Error('Solo puedes cambiar colores en el lobby')

    // Encontrar al jugador
    const playerGames = await this.playerGameModel.find_many({ gameId: new Types.ObjectId(gameId) })
    const player = playerGames.find((pg) => pg.userId === userId)
    if (!player) throw new Error('No perteneces a esta partida')

    // Actualizar colores
    player.customColors = colors
    await this.playerGameModel.update_by_id(player._id.toString(), player)

    return { message: 'Colores actualizados', customColors: colors }
  }

  async startSimonGame(game: any, _userId: number) {
    const playersResult = await Promise.all(
      game.players.map((pId: any) => this.playerGameModel.find_by_id(pId.toString()))
    )
    const players = playersResult.filter((p): p is NonNullable<typeof p> => !!p)

    // Validar que ambos estén listos y tengan colores
    const bothReady = players.every((p) => p.ready && p.customColors?.length === 6)
    if (!bothReady) {
      throw new Error('Ambos jugadores deben estar listos con 6 colores definidos')
    }

    // Escoger jugador inicial al azar
    const startingPlayer = players[Math.floor(Math.random() * players.length)]!
    const opponent = players.find((p) => p.userId !== startingPlayer.userId)!

    // El jugador inicial escoge el primer color para el oponente
    const firstColor = startingPlayer.customColors![Math.floor(Math.random() * 6)]

    // Agregar el primer color a la secuencia del OPONENTE
    opponent.sequence = [firstColor]
    await this.playerGameModel.update_by_id(opponent._id.toString(), opponent)

    // El oponente debe repetir su secuencia
    game.currentTurnUserId = opponent.userId
    game.status = 'in_progress'
    await this.gameModel.update_by_id(game._id.toString(), game)

    return {
      gameId: game._id.toString(),
      currentTurnUserId: game.currentTurnUserId,
      status: game.status,
      firstColorChosen: firstColor,
      chosenBy: startingPlayer.userId,
    }
  }

  // Jugador repite su secuencia
  async playMove(gameId: string, userId: number, playerSequence: string[]) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')
    if (game.status !== 'in_progress') throw new Error('El juego no está en progreso')
    if (game.currentTurnUserId !== userId) throw new Error('No es tu turno')

    const playerGames = await this.playerGameModel.find_many({ gameId: new Types.ObjectId(gameId) })
    const currentPlayer = playerGames.find((pg) => pg.userId === userId)
    const opponent = playerGames.find((pg) => pg.userId !== userId)

    if (!currentPlayer || !opponent) {
      throw new Error('No se encontraron ambos jugadores')
    }

    // La secuencia que debe repetir es SU PROPIA secuencia
    const mySequence = currentPlayer.sequence || []
    const expectedLength = mySequence.length

    if (playerSequence.length !== expectedLength) {
      throw new Error(`Debes repetir tu secuencia completa de ${expectedLength} colores`)
    }

    // Verificar que la secuencia sea correcta
    for (let i = 0; i < expectedLength; i++) {
      if (playerSequence[i] !== mySequence[i]) {
        // FALLÓ - El oponente gana
        return await this.endGame(gameId, opponent.userId, currentPlayer.userId, 'sequence_failed')
      }
    }

    // ✅ ACERTÓ su propia secuencia
    // Ahora debe escoger un color para agregar a la secuencia del OPONENTE
    game.currentTurnUserId = userId // Mantiene el turno para escoger color
    await this.gameModel.update_by_id(gameId, game)

    return {
      success: true,
      phase: 'choose_color',
      message: 'Secuencia correcta. Ahora escoge un color para tu oponente.',
      mySequence: mySequence,
    }
  }

  // Jugador escoge un color para agregar a la secuencia del oponente
  async chooseColor(gameId: string, userId: number, chosenColor: string) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')
    if (game.status !== 'in_progress') throw new Error('El juego no está en progreso')
    if (game.currentTurnUserId !== userId) throw new Error('No es tu turno')

    const playerGames = await this.playerGameModel.find_many({ gameId: new Types.ObjectId(gameId) })
    const currentPlayer = playerGames.find((pg) => pg.userId === userId)
    const opponent = playerGames.find((pg) => pg.userId !== userId)

    if (!currentPlayer || !opponent) {
      throw new Error('No se encontraron ambos jugadores')
    }

    // Validar que el color elegido esté en los colores del jugador actual
    if (!currentPlayer.customColors?.includes(chosenColor)) {
      throw new Error('Debes escoger un color de tu paleta')
    }

    // Agregar el color a la secuencia del OPONENTE
    const newOpponentSequence = [...(opponent.sequence || []), chosenColor]
    opponent.sequence = newOpponentSequence
    await this.playerGameModel.update_by_id(opponent._id.toString(), opponent)

    // Turno del oponente para repetir SU secuencia
    game.currentTurnUserId = opponent.userId
    await this.gameModel.update_by_id(gameId, game)

    return {
      success: true,
      phase: 'opponent_turn',
      message: `Color ${chosenColor} agregado a la secuencia del oponente.`,
      currentTurnUserId: opponent.userId,
      colorAddedToOpponent: chosenColor,
    }
  }

  private async endGame(gameId: string, winnerId: number, loserId: number, reason: string) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    const playerGames = await this.playerGameModel.find_many({ gameId: new Types.ObjectId(gameId) })
    const winner = playerGames.find((pg) => pg.userId === winnerId)
    const loser = playerGames.find((pg) => pg.userId === loserId)

    if (winner && loser) {
      winner.result = 'win'
      loser.result = 'lose'
      await this.playerGameModel.update_by_id(winner._id.toString(), winner)
      await this.playerGameModel.update_by_id(loser._id.toString(), loser)
    }

    game.status = 'finished'
    game.winner = winnerId
    game.currentTurnUserId = null
    await this.gameModel.update_by_id(gameId, game)

    return {
      success: false,
      game_over: true,
      winner: winnerId,
      loser: loserId,
      reason,
      myFinalSequence: loser?.sequence || [],
      opponentFinalSequence: winner?.sequence || [],
    }
  }

  async getSimonGameStatus(game: GameDoc, userId: number) {
    const playerDocs = await Promise.all(
      game.players.map((pId: any) => this.playerGameModel.find_by_id(pId.toString()))
    )

    const players = playerDocs.filter(Boolean)
    const me = players.find((p) => p!.userId === userId)
    const opponent = players.find((p) => p!.userId !== userId)

    if (!me) throw new Error('No perteneces a esta partida')
    if (!opponent) throw new Error('No hay oponente en la partida')

    // Si el juego terminó, mostrar resultado final
    if (game.status === 'finished') {
      const winnerUser = await User.find(game.winner!)
      const loserUser = await User.find(game.winner === me.userId ? opponent.userId : me.userId)

      return {
        status: 'finished',
        winner: game.winner,
        winnerName: winnerUser?.name || 'Desconocido',
        loserName: loserUser?.name || 'Desconocido',
        mySequence: me.sequence || [],
        opponentSequence: opponent.sequence || [],
        myColors: me.customColors || [],
        opponentColors: opponent.customColors || [],
      }
    }

    // Obtener usuarios para mostrar nombres
    const users = await Promise.all([User.find(me.userId), User.find(opponent.userId)])

    return {
      status: game.status,
      currentTurnUserId: game.currentTurnUserId,
      players: players.map((p, idx) => ({
        userId: p!.userId,
        ready: p!.ready,
        customColors: p!.customColors || [],
        sequence: p!.sequence || [],
        user: users[idx]
          ? {
              id: users[idx]!.id,
              name: users[idx]!.name,
              wins: users[idx]!.wins,
              losses: users[idx]!.losses,
              level: users[idx]!.level,
            }
          : undefined,
      })),
      mySequence: me.sequence || [], // Mi secuencia (colores que debo repetir)
      opponentSequence: opponent.sequence || [], // Secuencia del oponente
      myColors: me.customColors || [], // Mis colores para escoger
      opponentColors: opponent.customColors || [], // Colores del oponente
      isMyTurn: game.currentTurnUserId === userId,
      mySequenceLength: (me.sequence || []).length,
      opponentSequenceLength: (opponent.sequence || []).length,
    }
  }

  async getSimonLobbyStatus(game: GameDoc, userId: number) {
    const playerDocs = await this.getPlayerLobbyData(game)
    this.verifyPlayerInGame(playerDocs, userId)

    const bothReady = playerDocs.every((p) => p.ready)
    const bothHaveColors = playerDocs.every((p) => p.customColors?.length === 6)

    if (bothReady && bothHaveColors && game.status === 'waiting') {
      await this.gameModel.update_by_id(game._id.toString(), { status: 'started' })
      game.status = 'started'
    }

    return {
      status: game.status,
      players: playerDocs.map((p) => ({
        ...p,
        hasColors: p.customColors?.length === 6,
      })),
      started: game.status === 'started',
    }
  }

  // Métodos auxiliares
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
          customColors: player.customColors || [],
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
}
