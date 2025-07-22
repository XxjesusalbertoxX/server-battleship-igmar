import { GameModel, GameDoc } from '../models/game.js'
import { PlayerGameModel } from '../models/player_game.js'
import User from '../models/user.js'

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

  async startSimonGame(game: any, _userId: number) {
    const playersResult = await Promise.all(
      game.players.map((pId: any) => this.playerGameModel.find_by_id(pId.toString()))
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

  async getSimonGameStatus(game: GameDoc, userId: number) {
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

  async getSimonLobbyStatus(game: GameDoc, userId: number) {
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

  public async setColors(gameId: string, _userId: number, colors?: string[]) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    if (game.gameType !== 'simonsay') throw new Error('Solo aplica para Simon Says')

    // Validación: colores
    const finalColors =
      colors && colors.length === 6
        ? colors
        : ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'] // Defaults

    game.customColors = finalColors
    await this.gameModel.update_by_id(gameId, game)

    // También puedes actualizar playerGames si quieres mantener referencia directa:
    const playerGames = await Promise.all(
      game.players.map((pId) => this.playerGameModel.find_by_id(pId.toString()))
    )

    await Promise.all(
      playerGames
        .filter((pg): pg is NonNullable<typeof pg> => pg !== null)
        .map((pg) => {
          pg.customColors = finalColors
          return this.playerGameModel.update_by_id(pg._id.toString(), pg)
        })
    )

    return { customColors: finalColors }
  }

  public async playMove(gameId: string, userId: number, chosenColor: string) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')
    if (game.gameType !== 'simonsay') throw new Error('Solo aplica para Simon Says')
    if (game.status !== 'in_progress') throw new Error('El juego no está en progreso')

    // Obtener los PlayerGame del jugador actual y del oponente
    const playerGames = await this.playerGameModel.find_many({ gameId })
    const currentPlayer = playerGames.find((pg) => pg.userId === userId)
    const opponentPlayer = playerGames.find((pg) => pg.userId !== userId)

    if (!currentPlayer || !opponentPlayer) {
      throw new Error('No se encontraron ambos jugadores en la partida')
    }

    // Validar que sea el turno del jugador actual
    if (game.currentTurnUserId !== userId) {
      throw new Error('No es tu turno')
    }

    // Validar la secuencia del oponente
    const opponentSequence = opponentPlayer.sequence || []
    const expectedColor = opponentSequence[currentPlayer.sequence.length]

    if (chosenColor !== expectedColor) {
      // Si falla, el oponente gana
      game.status = 'finished'
      game.winner = opponentPlayer.userId
      game.currentTurnUserId = null

      await this.gameModel.update_by_id(gameId, game)
      return { success: false, winner: opponentPlayer.userId }
    }

    // Si acierta, agregar el color a la secuencia del oponente
    currentPlayer.sequence.push(chosenColor)
    if (currentPlayer.sequence.length === opponentSequence.length) {
      // Secuencia completada, agregar un nuevo color a la secuencia del oponente
      const newColor = this.getRandomColor(opponentPlayer.customColors || [])
      opponentPlayer.sequence.push(newColor)

      // Cambiar el turno al oponente
      game.currentTurnUserId = opponentPlayer.userId
      await this.playerGameModel.update_by_id(opponentPlayer._id.toString(), opponentPlayer)
    }

    await this.playerGameModel.update_by_id(currentPlayer._id.toString(), currentPlayer)
    await this.gameModel.update_by_id(gameId, game)

    return {
      success: true,
      sequence: currentPlayer.sequence,
      nextColor: opponentPlayer.sequence[opponentPlayer.sequence.length - 1],
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

  private getRandomColor(colors: string[]) {
    return colors[Math.floor(Math.random() * colors.length)]
  }

  private async getOpponentPlayer(userId: number, game: GameDoc) {
    const playerGames = await Promise.all(
      game.players.map((pId) => this.playerGameModel.find_by_id(pId.toString()))
    )
    const opponent = playerGames.find((pg) => pg?.userId !== userId)
    if (!opponent) throw new Error('No se encontró oponente')
    return opponent
  }
}
