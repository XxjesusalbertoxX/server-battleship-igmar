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

    const bothReady = players.every((p) => p.ready && p.customColors?.length === 6)
    if (!bothReady) {
      throw new Error('Ambos jugadores deben estar listos con 6 colores definidos')
    }

    // Escoger jugador inicial al azar
    const startingPlayer = players[Math.floor(Math.random() * players.length)]!

    // El jugador inicial debe escoger el primer color manualmente
    game.currentTurnUserId = startingPlayer.userId
    game.status = 'waiting_first_color' // Estado especial para el primer color
    await this.gameModel.update_by_id(game._id.toString(), game)

    return {
      gameId: game._id.toString(),
      currentTurnUserId: game.currentTurnUserId,
      status: game.status,
      phase: 'choose_first_color',
      message: 'Escoge el primer color para tu oponente',
    }
  }

  // NUEVO: Escoger el primer color del juego
  // Cambiar en chooseFirstColor:
  async chooseFirstColor(gameId: string, userId: number, chosenColor: string) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')
    if (game.status !== 'waiting_first_color')
      throw new Error('No es momento de escoger el primer color')
    if (game.currentTurnUserId !== userId) throw new Error('No es tu turno')

    const playerGames = await this.playerGameModel.find_many({ gameId: new Types.ObjectId(gameId) })
    const currentPlayer = playerGames.find((pg) => pg.userId === userId)
    const opponent = playerGames.find((pg) => pg.userId !== userId)

    if (!currentPlayer || !opponent) {
      throw new Error('No se encontraron ambos jugadores')
    }

    // CAMBIO: En lugar de validar contra mis colores actuales,
    // validar contra los colores que están disponibles para el oponente
    // (que son los colores que YO elegí originalmente en el lobby)

    // Los colores que puedo usar para el oponente son los que están en su tablero
    // que son los que YO elegí para él en el lobby
    const availableColorsForOpponent = opponent.customColors || []

    if (!availableColorsForOpponent.includes(chosenColor)) {
      throw new Error('Debes escoger un color que esté disponible para tu oponente')
    }

    // Agregar el primer color a la secuencia del OPONENTE
    opponent.sequence = [chosenColor]
    opponent.currentSequenceIndex = 0
    await this.playerGameModel.update_by_id(opponent._id.toString(), opponent)

    // Ahora es turno del oponente para repetir
    game.currentTurnUserId = opponent.userId
    game.status = 'in_progress'
    await this.gameModel.update_by_id(gameId, game)

    return {
      success: true,
      phase: 'opponent_turn',
      message: `Color ${chosenColor} agregado. Turno del oponente para repetir.`,
      currentTurnUserId: opponent.userId,
      sequenceLength: 1,
    }
  }
  // NUEVO: Validar un solo color en la secuencia
  async playColor(gameId: string, userId: number, color: string) {
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

    const mySequence = currentPlayer.sequence || []
    const currentIndex = currentPlayer.currentSequenceIndex || 0

    // Verificar si ya completó la secuencia
    if (currentIndex >= mySequence.length) {
      throw new Error('Ya completaste tu secuencia')
    }

    // Verificar si el color es correcto
    const expectedColor = mySequence[currentIndex]
    if (color !== expectedColor) {
      // FALLÓ - El oponente gana
      return await this.endGame(gameId, opponent.userId, currentPlayer.userId, 'wrong_color')
    }

    // Color correcto, avanzar índice
    const newIndex = currentIndex + 1
    currentPlayer.currentSequenceIndex = newIndex
    await this.playerGameModel.update_by_id(currentPlayer._id.toString(), currentPlayer)

    // ¿Completó toda la secuencia?
    if (newIndex >= mySequence.length) {
      // Completó la secuencia, ahora debe escoger color para el oponente
      return {
        success: true,
        phase: 'choose_color',
        message: '¡Secuencia completada! Ahora escoge un color para tu oponente.',
        sequenceCompleted: true,
        colorsCorrect: newIndex,
        totalColors: mySequence.length,
      }
    } else {
      // Aún le faltan colores
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

  // ACTUALIZAR: Escoger color para el oponente (sin cambios mayores)
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

    // Verificar que completó su secuencia
    const mySequence = currentPlayer.sequence || []
    const currentIndex = currentPlayer.currentSequenceIndex || 0
    if (currentIndex < mySequence.length) {
      throw new Error('Primero debes completar tu secuencia')
    }

    // if (!currentPlayer.customColors?.includes(chosenColor)) {
    //   throw new Error('Debes escoger un color de tu paleta')
    // }

    const availableColorsForOpponent = opponent.customColors || []

    if (!availableColorsForOpponent.includes(chosenColor)) {
      throw new Error('Debes escoger un color que esté disponible para tu oponente')
    }

    // Agregar color a la secuencia del oponente
    const newOpponentSequence = [...(opponent.sequence || []), chosenColor]
    opponent.sequence = newOpponentSequence
    opponent.currentSequenceIndex = 0 // Reiniciar índice para la nueva secuencia
    await this.playerGameModel.update_by_id(opponent._id.toString(), opponent)

    // Reiniciar el índice del jugador actual para la próxima ronda
    currentPlayer.currentSequenceIndex = 0
    await this.playerGameModel.update_by_id(currentPlayer._id.toString(), currentPlayer)

    // Turno del oponente
    game.currentTurnUserId = opponent.userId
    await this.gameModel.update_by_id(gameId, game)

    return {
      success: true,
      phase: 'opponent_turn',
      message: `Color ${chosenColor} agregado. Turno del oponente.`,
      currentTurnUserId: opponent.userId,
      opponentSequenceLength: newOpponentSequence.length,
    }
  }

  // ACTUALIZAR: Estado del juego (sin mostrar secuencias completas)
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

    // En progreso: NO mostrar secuencias, solo longitudes e información de turno
    const users = await Promise.all([User.find(me.userId), User.find(opponent.userId)])

    return {
      status: game.status,
      currentTurnUserId: game.currentTurnUserId,
      players: players.map((p, idx) => ({
        userId: p!.userId,
        ready: p!.ready,
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

      // Solo información de progreso, NO las secuencias completas
      myColors: opponent.customColors || [],
      myCustomColors: me.customColors || [], // <-- Agrega esto
      opponentColors: me.customColors || [],
      isMyTurn: game.currentTurnUserId === userId,
      mySequenceLength: (me.sequence || []).length,
      opponentSequenceLength: (opponent.sequence || []).length,
      myCurrentProgress: me.currentSequenceIndex || 0,
      // Información de fase actual
      phase:
        game.status === 'waiting_first_color'
          ? 'choose_first_color'
          : (me.currentSequenceIndex || 0) < (me.sequence || []).length
            ? 'repeat_sequence'
            : 'choose_color',
      opponentName:
        users[1]?.name === users[0]?.name
          ? users[0]?.name // fallback si solo hay uno
          : users.find((u) => u?.id === opponent.userId)?.name || 'Oponente',
      lastColorAdded:
        me.sequence && me.sequence.length > 0 ? me.sequence[me.sequence.length - 1] : null,
      mySequenceVersion: me.sequence ? me.sequence.length : 0, // Nuevo: versión de la secuencia
    }
  }

  async getSimonLobbyStatus(game: GameDoc, userId: number) {
    const defaultColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange']

    const playerIds = game.players
    const playerDocs = await this.getPlayerLobbyData(game)
    this.verifyPlayerInGame(playerDocs, userId)

    for (const [i, p] of playerDocs.entries()) {
      if (!p.customColors || p.customColors.length !== 6) {
        p.customColors = defaultColors
        const playerGame = await this.playerGameModel.find_by_id(playerIds[i].toString())
        if (playerGame) {
          playerGame.customColors = defaultColors
          await this.playerGameModel.update_by_id(playerGame._id.toString(), playerGame)
        }
      }
    }

    const bothReady = playerDocs.length === 2 && playerDocs.every((p) => p.ready)
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

  private verifyPlayerInGame(playerDocs: any[], userId: number) {
    const me = playerDocs.find((p) => p.userId === userId)
    if (!me) throw new Error('No perteneces a esta partida')
  }
}
