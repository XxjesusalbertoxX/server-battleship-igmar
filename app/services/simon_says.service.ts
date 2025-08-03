import { GameModel } from '#models/game'
import { PlayerGameModel } from '#models/player_game'
import UserService from './user.service.js'
import User from '#models/user'

export class SimonSaysService {
  private playerGameModel = PlayerGameModel.simonSay
  private userService = new UserService()

  async createSimonGame({
    userIds,
    code,
    customColors,
  }: {
    userIds: number[]
    code: string
    customColors?: string[]
  }) {
    const createdGame = await GameModel.createGame('simonsay', {
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
      ready: false,
      customColors: customColors || [],
      sequence: [],
    }))

    const createdPlayerGames = await Promise.all(
      playerGamesData.map((data) => PlayerGameModel.createPlayer('simonsay', data))
    )

    createdGame.players = createdPlayerGames.map((pg) => pg._id)
    await GameModel.update_by_id(createdGame._id.toString(), createdGame)

    return { id: createdGame._id.toString(), code: createdGame.code }
  }

  async setColors(gameId: string, userId: number, colors: string[]) {
    if (!colors || colors.length !== 6) {
      throw new Error('Debes escoger exactamente 6 colores')
    }

    const game = await GameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')
    if (game.status !== 'waiting') throw new Error('Solo puedes cambiar colores en el lobby')

    const playerGames = await this.playerGameModel.findByGameId(gameId)
    const player = playerGames.find((pg) => pg.userId === userId)
    if (!player) throw new Error('No perteneces a esta partida')

    await this.playerGameModel.updateColors(player._id.toString(), colors)

    return { message: 'Colores actualizados', customColors: colors }
  }

  async startSimonGame(game: any, _userId: number) {
    const players = await this.playerGameModel.findByGameId(game._id.toString())

    const bothReady = players.every((p) => p.ready && p.customColors?.length === 6)
    if (!bothReady) {
      throw new Error('Ambos jugadores deben estar listos con 6 colores definidos')
    }

    const startingPlayer = players[Math.floor(Math.random() * players.length)]!

    game.currentTurnUserId = startingPlayer.userId
    game.status = 'waiting_first_color'
    await GameModel.update_by_id(game._id.toString(), game)

    return {
      gameId: game._id.toString(),
      currentTurnUserId: game.currentTurnUserId,
      status: game.status,
      phase: 'choose_first_color',
      message: 'Escoge el primer color para tu oponente',
    }
  }

  async chooseFirstColor(gameId: string, userId: number, chosenColor: string) {
    const game = (await GameModel.find_by_id(
      gameId
    )) as import('#models/simonsay/game_simon_say').GameSimonSayDoc
    if (!game) throw new Error('Juego no encontrado')
    if (game.status !== 'waiting_first_color')
      throw new Error('No es momento de escoger el primer color')
    if (game.currentTurnUserId !== userId) throw new Error('No es tu turno')

    const playerGames = await this.playerGameModel.findByGameId(gameId)
    const currentPlayer = playerGames.find((pg) => pg.userId === userId)
    const opponent = playerGames.find((pg) => pg.userId !== userId)

    if (!currentPlayer || !opponent) {
      throw new Error('No se encontraron ambos jugadores')
    }

    const availableColorsForOpponent = currentPlayer.customColors || []

    if (!availableColorsForOpponent.includes(chosenColor)) {
      throw new Error('Debes escoger un color que esté disponible para tu oponente')
    }

    await this.playerGameModel.updateSequence(opponent._id.toString(), [chosenColor])
    await this.playerGameModel.updateCurrentIndex(opponent._id.toString(), 0)

    game.currentTurnUserId = opponent.userId
    game.status = 'in_progress'
    await GameModel.update_by_id(gameId, game)

    return {
      success: true,
      phase: 'opponent_turn',
      message: `Color ${chosenColor} agregado. Turno del oponente para repetir.`,
      currentTurnUserId: opponent.userId,
      sequenceLength: 1,
    }
  }

  async playColor(gameId: string, userId: number, color: string) {
    const game = await GameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')
    if (game.status !== 'in_progress') throw new Error('El juego no está en progreso')
    if (game.currentTurnUserId !== userId) throw new Error('No es tu turno')

    const playerGames = await this.playerGameModel.findByGameId(gameId)
    const currentPlayer = playerGames.find((pg) => pg.userId === userId)
    const opponent = playerGames.find((pg) => pg.userId !== userId)

    if (!currentPlayer || !opponent) {
      throw new Error('No se encontraron ambos jugadores')
    }

    const mySequence = currentPlayer.sequence || []
    const currentIndex = currentPlayer.currentSequenceIndex || 0

    if (currentIndex >= mySequence.length) {
      throw new Error('Ya completaste tu secuencia')
    }

    const expectedColor = mySequence[currentIndex]
    if (color !== expectedColor) {
      return await this.endGame(gameId, opponent.userId, currentPlayer.userId, 'wrong_color')
    }

    const newIndex = currentIndex + 1
    await this.playerGameModel.updateCurrentIndex(currentPlayer._id.toString(), newIndex)

    if (newIndex >= mySequence.length) {
      return {
        success: true,
        phase: 'choose_color',
        message: '¡Secuencia completada! Ahora escoge un color para tu oponente.',
        sequenceCompleted: true,
        colorsCorrect: newIndex,
        totalColors: mySequence.length,
      }
    } else {
      return {
        success: true,
        phase: 'continue_sequence',
        message: `Color correcto. Continúa con el siguiente color.`,
        sequenceCompleted: false,
        colorsCorrect: newIndex,
        totalColors: mySequence.length,
        nextColorIndex: newIndex,
      }
    }
  }

  async chooseColor(gameId: string, userId: number, chosenColor: string) {
    const game = await GameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')
    if (game.status !== 'in_progress') throw new Error('El juego no está en progreso')
    if (game.currentTurnUserId !== userId) throw new Error('No es tu turno')

    const playerGames = await this.playerGameModel.findByGameId(gameId)
    const currentPlayer = playerGames.find((pg) => pg.userId === userId)
    const opponent = playerGames.find((pg) => pg.userId !== userId)

    if (!currentPlayer || !opponent) {
      throw new Error('No se encontraron ambos jugadores')
    }

    const mySequence = currentPlayer.sequence || []
    const currentIndex = currentPlayer.currentSequenceIndex || 0
    if (currentIndex < mySequence.length) {
      throw new Error('Primero debes completar tu secuencia')
    }

    const availableColorsForOpponent = currentPlayer.customColors || []

    if (!availableColorsForOpponent.includes(chosenColor)) {
      throw new Error('Debes escoger un color que esté disponible para tu oponente')
    }

    const newOpponentSequence = [...(opponent.sequence || []), chosenColor]
    await this.playerGameModel.updateSequence(opponent._id.toString(), newOpponentSequence)
    await this.playerGameModel.updateCurrentIndex(opponent._id.toString(), 0)
    await this.playerGameModel.updateCurrentIndex(currentPlayer._id.toString(), 0)

    game.currentTurnUserId = opponent.userId
    await GameModel.update_by_id(gameId, game)

    return {
      success: true,
      phase: 'opponent_turn',
      message: `Color ${chosenColor} agregado. Turno del oponente.`,
      currentTurnUserId: opponent.userId,
      opponentSequenceLength: newOpponentSequence.length,
    }
  }

  async getSimonGameStatus(game: any, userId: number) {
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
        mySequence: me.sequence || [],
        opponentSequence: opponent.sequence || [],
        myColors: me.customColors || [],
        opponentColors: opponent.customColors || [],
      }
    }

    const users = await Promise.all([User.find(me.userId), User.find(opponent.userId)])

    return {
      status: game.status,
      currentTurnUserId: game.currentTurnUserId,
      players: players.map((p, idx) => ({
        userId: p!.userId,
        ready: p!.ready,
        // SOLO campos específicos de Simon Say
        customColors: p!.customColors || [],
        sequence: p!.sequence || [],
        currentSequenceIndex: p!.currentSequenceIndex || 0,
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
      myColors: opponent.customColors || [],
      myCustomColors: me.customColors || [],
      opponentColors: me.customColors || [],
      isMyTurn: game.currentTurnUserId === userId,
      mySequenceLength: (me.sequence || []).length,
      opponentSequenceLength: (opponent.sequence || []).length,
      myCurrentProgress: me.currentSequenceIndex || 0,
      phase:
        game.status === 'waiting_first_color'
          ? 'choose_first_color'
          : (me.currentSequenceIndex || 0) < (me.sequence || []).length
            ? 'repeat_sequence'
            : 'choose_color',
      opponentName:
        users[1]?.name === users[0]?.name
          ? users[0]?.name
          : users.find((u) => u?.id === opponent.userId)?.name || 'Oponente',
      lastColorAdded:
        me.sequence && me.sequence.length > 0 ? me.sequence[me.sequence.length - 1] : null,
      mySequenceVersion: me.sequence ? me.sequence.length : 0,
    }
  }

  async getSimonLobbyStatus(game: any, userId: number) {
    const defaultColors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#800080', '#FFA500']

    const playerDocs = await this.getPlayerLobbyData(game)
    this.verifyPlayerInGame(playerDocs, userId)

    for (const p of playerDocs) {
      if (!p.customColors || p.customColors.length !== 6) {
        p.customColors = defaultColors
        await this.playerGameModel.updateColors(p._id, defaultColors)
      }
    }

    const bothReady = playerDocs.length === 2 && playerDocs.every((p) => p.ready)
    const bothHaveColors = playerDocs.every((p) => p.customColors?.length === 6)

    if (bothReady && bothHaveColors && game.status === 'waiting') {
      await GameModel.update_by_id(game._id.toString(), { status: 'started' })
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

  // LIMPIO - Solo campos de Simon Say
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
          // SOLO campos específicos de Simon Say
          customColors: player.customColors || [],
          sequence: player.sequence || [],
          currentSequenceIndex: player.currentSequenceIndex || 0,
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
    const game = await GameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    const playerGames = await this.playerGameModel.findByGameId(gameId)
    const winner = playerGames.find((pg) => pg.userId === winnerId)
    const loser = playerGames.find((pg) => pg.userId === loserId)

    if (winner && loser) {
      await this.playerGameModel.update_by_id(winner._id.toString(), { result: 'win' })
      await this.playerGameModel.update_by_id(loser._id.toString(), { result: 'lose' })
    }

    await GameModel.update_by_id(gameId, {
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

  private verifyPlayerInGame(playerDocs: any[], userId: number) {
    const me = playerDocs.find((p) => p.userId === userId)
    if (!me) throw new Error('No perteneces a esta partida')
  }
}
