import { GameModel } from '#models/game'
import { PlayerGameModel } from '#models/player_game'
import type { GameSimonSayDoc } from '#models/simonsay/game_simon_say'
import UserService from './user.service.js'
import User from '#models/user'

export class SimonSaysService {
  private gameModel = GameModel.simonSay
  private playerGameModel = PlayerGameModel.simonSay
  private userService = new UserService()

  async createSimonGame({
    userIds,
    code,
    availableColors,
  }: {
    userIds: number[]
    code: string
    availableColors: string[] // Colores seleccionados por el creador
  }) {
    if (!availableColors || availableColors.length < 2) {
      throw new Error('Debes seleccionar al menos 2 colores')
    }

    const createdGame = await GameModel.createGame('simonsay', {
      code,
      players: [],
      status: 'waiting',
      hasStarted: false,
      currentTurnUserId: null,
      surrenderedBy: [],
      availableColors, // Colores para toda la partida
      globalSequence: [],
      currentSequenceIndex: 0,
      playerRepeatingUserId: null,
      playerChoosingUserId: null,
      lastAddedColor: null,
    })

    const playerGamesData = userIds.map((userId) => ({
      userId,
      gameId: createdGame._id,
      ready: false,
      customColorsSelected: true, // El creador ya seleccionó los colores
    }))

    const createdPlayerGames = await Promise.all(
      playerGamesData.map((data) => PlayerGameModel.createPlayer('simonsay', data))
    )

    createdGame.players = createdPlayerGames.map((pg) => pg._id)
    await GameModel.update_by_id(createdGame._id.toString(), createdGame)

    return {
      id: createdGame._id.toString(),
      code: createdGame.code,
      availableColors: (createdGame as GameSimonSayDoc).availableColors,
    }
  }

  async startSimonGame(game: GameSimonSayDoc, _userId: number) {
    const players = await this.playerGameModel.findByGameId(game._id.toString())

    const bothReady = players.every((p) => p.ready)
    if (!bothReady) {
      throw new Error('Ambos jugadores deben estar listos')
    }

    if (players.length !== 2) {
      throw new Error('Se necesitan exactamente 2 jugadores')
    }

    // El jugador que inicia escoge el primer color
    const startingPlayer = players[Math.floor(Math.random() * players.length)]!

    await this.gameModel.update_by_id(game._id.toString(), {
      status: 'choosing_first_color',
      playerChoosingUserId: startingPlayer.userId,
      playerRepeatingUserId: null,
      currentTurnUserId: startingPlayer.userId,
    })

    return {
      gameId: game._id.toString(),
      currentTurnUserId: startingPlayer.userId,
      status: 'choosing_first_color',
      phase: 'choosing_first_color',
      message: 'Escoge el primer color de la secuencia',
      availableColors: game.availableColors,
    }
  }

  async chooseColor(gameId: string, userId: number, chosenColor: string) {
    const game = (await this.gameModel.find_by_id(gameId)) as GameSimonSayDoc
    if (!game) throw new Error('Juego no encontrado')

    const validChoosingStates = ['choosing_first_color', 'choosing_next_color']
    if (!validChoosingStates.includes(game.status)) {
      throw new Error('No es momento de escoger color')
    }

    if (game.playerChoosingUserId !== userId) {
      throw new Error('No es tu turno para escoger color')
    }

    if (!game.availableColors.includes(chosenColor)) {
      throw new Error('Color no válido para esta partida')
    }

    const players = await this.playerGameModel.findByGameId(gameId)
    const opponent = players.find((p) => p.userId !== userId)
    if (!opponent) throw new Error('No se encontró el oponente')

    // Agregar color a la secuencia global
    await this.gameModel.addColorToSequence(gameId, chosenColor)

    // Cambiar estado: ahora el oponente debe repetir toda la secuencia
    await this.gameModel.update_by_id(gameId, {
      status: 'repeating_sequence',
      playerRepeatingUserId: opponent.userId,
      playerChoosingUserId: null,
      currentTurnUserId: opponent.userId,
      currentSequenceIndex: 0,
    })

    const updatedGame = (await this.gameModel.find_by_id(gameId)) as GameSimonSayDoc

    return {
      success: true,
      phase: 'repeating_sequence',
      message: `Color ${chosenColor} agregado. El oponente debe repetir la secuencia.`,
      currentTurnUserId: opponent.userId,
      globalSequence: updatedGame.globalSequence,
      sequenceLength: updatedGame.globalSequence.length,
      colorAdded: chosenColor,
    }
  }

  async repeatSequenceColor(gameId: string, userId: number, color: string) {
    const game = (await this.gameModel.find_by_id(gameId)) as GameSimonSayDoc
    if (!game) throw new Error('Juego no encontrado')

    if (game.status !== 'repeating_sequence') {
      throw new Error('No es momento de repetir la secuencia')
    }

    if (game.playerRepeatingUserId !== userId) {
      throw new Error('No es tu turno para repetir')
    }

    const currentIndex = game.currentSequenceIndex
    const expectedColor = game.globalSequence[currentIndex]

    if (color !== expectedColor) {
      // Error en la secuencia - el jugador pierde
      const players = await this.playerGameModel.findByGameId(gameId)
      const winner = players.find((p) => p.userId !== userId)
      return await this.endGame(gameId, winner!.userId, userId, 'wrong_color')
    }

    const newIndex = currentIndex + 1
    await this.gameModel.updateSequenceProgress(gameId, newIndex)

    // Verificar si completó toda la secuencia
    if (newIndex >= game.globalSequence.length) {
      // Completó la secuencia - ahora le toca escoger el siguiente color
      await this.gameModel.update_by_id(gameId, {
        status: 'choosing_next_color',
        playerChoosingUserId: userId,
        playerRepeatingUserId: null,
        currentTurnUserId: userId,
        currentSequenceIndex: 0,
      })

      return {
        success: true,
        phase: 'choosing_next_color',
        message: '¡Secuencia completada! Ahora escoge el siguiente color.',
        sequenceCompleted: true,
        colorsCorrect: newIndex,
        totalColors: game.globalSequence.length,
        currentTurnUserId: userId,
      }
    } else {
      // Continúa repitiendo la secuencia
      return {
        success: true,
        phase: 'repeating_sequence',
        message: `Color correcto. Continúa con el siguiente.`,
        sequenceCompleted: false,
        colorsCorrect: newIndex,
        totalColors: game.globalSequence.length,
        nextColorIndex: newIndex,
        expectedNextColor: game.globalSequence[newIndex], // Para debugging
      }
    }
  }

  async getSimonGameStatus(game: GameSimonSayDoc, userId: number) {
    const players = await this.playerGameModel.findByGameId(game._id.toString())
    const me = players.find((p) => p.userId === userId)
    const opponent = players.find((p) => p.userId !== userId)

    if (!me) throw new Error('No perteneces a esta partida')
    if (!opponent) throw new Error('No hay oponente en la partida')

    if (game.status === 'finished') {
      const winnerUser = await User.find(game.winner!)
      const loserUser = await User.find(game.winner === me.userId ? opponent.userId : me.userId)

      return {
        status: 'finished',
        winner: game.winner,
        winnerName: winnerUser?.name || 'Desconocido',
        loserName: loserUser?.name || 'Desconocido',
        finalSequence: game.globalSequence,
        availableColors: game.availableColors,
        sequenceLength: game.globalSequence.length,
      }
    }

    const users = await Promise.all([User.find(me.userId), User.find(opponent.userId)])

    return {
      status: game.status,
      currentTurnUserId: game.currentTurnUserId,
      globalSequence: game.globalSequence,
      availableColors: game.availableColors,
      currentSequenceIndex: game.currentSequenceIndex,
      lastAddedColor: game.lastAddedColor,
      playerRepeatingUserId: game.playerRepeatingUserId,
      playerChoosingUserId: game.playerChoosingUserId,
      isMyTurn: game.currentTurnUserId === userId,
      phase: this.determinePhase(game, userId),
      sequenceLength: game.globalSequence.length,
      players: players.map((p, idx) => ({
        userId: p.userId,
        ready: p.ready,
        customColorsSelected: p.customColorsSelected,
        user: users[idx]
          ? {
              id: users[idx]!.id,
              name: users[idx]!.name,
              wins: users[idx]!.wins,
              losses: users[idx]!.losses,
              level: users[idx]!.level,
              exp: users[idx]!.exp,
            }
          : undefined,
      })),
      opponentName: users.find((u) => u?.id !== me.userId)?.name || 'Oponente',
    }
  }

  async getSimonLobbyStatus(game: GameSimonSayDoc, userId: number) {
    const playerDocs = await this.getPlayerLobbyData(game)
    this.verifyPlayerInGame(playerDocs, userId)

    const bothReady = playerDocs.length === 2 && playerDocs.every((p) => p.ready)

    if (bothReady && game.status === 'waiting') {
      await GameModel.update_by_id(game._id.toString(), { status: 'started' })
      game.status = 'started'
    }

    return {
      status: game.status,
      availableColors: game.availableColors,
      players: playerDocs,
      started: game.status === 'started',
      canStart: bothReady,
    }
  }

  private determinePhase(game: GameSimonSayDoc, userId: number): string {
    switch (game.status) {
      case 'choosing_first_color':
        return game.playerChoosingUserId === userId ? 'choose_first_color' : 'wait_opponent_choose'
      case 'choosing_next_color':
        return game.playerChoosingUserId === userId ? 'choose_next_color' : 'wait_opponent_choose'
      case 'repeating_sequence':
        return game.playerRepeatingUserId === userId ? 'repeat_sequence' : 'wait_opponent_repeat'
      default:
        return 'unknown'
    }
  }

  private async getPlayerLobbyData(game: GameSimonSayDoc) {
    const players = await this.playerGameModel.findByGameId(game._id.toString())

    return Promise.all(
      players.map(async (player) => {
        const user = await User.find(player.userId)
        if (!user) throw new Error(`Usuario con id ${player.userId} no encontrado`)

        return {
          _id: player._id.toString(),
          userId: player.userId,
          ready: player.ready,
          customColorsSelected: player.customColorsSelected,
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

  private async endGame(gameId: string, winnerId: number, loserId: number, reason: string) {
    const players = await this.playerGameModel.findByGameId(gameId)
    const winner = players.find((pg) => pg.userId === winnerId)
    const loser = players.find((pg) => pg.userId === loserId)

    if (winner && loser) {
      await this.playerGameModel.update_by_id(winner._id.toString(), { result: 'win' })
      await this.playerGameModel.update_by_id(loser._id.toString(), { result: 'lose' })
    }

    await this.gameModel.update_by_id(gameId, {
      status: 'finished',
      winner: winnerId,
      currentTurnUserId: null,
    })

    try {
      await this.userService.grantWinExperience(winnerId)
      await this.userService.grantLossExperience(loserId)
    } catch (error) {
      console.error('Error otorgando experiencia:', error)
    }

    const game = (await this.gameModel.find_by_id(gameId)) as GameSimonSayDoc

    return {
      success: false,
      game_over: true,
      winner: winnerId,
      loser: loserId,
      reason,
      finalSequence: game.globalSequence,
      sequenceLength: game.globalSequence.length,
    }
  }

  private verifyPlayerInGame(playerDocs: any[], userId: number) {
    const me = playerDocs.find((p) => p.userId === userId)
    if (!me) throw new Error('No perteneces a esta partida')
  }
}
