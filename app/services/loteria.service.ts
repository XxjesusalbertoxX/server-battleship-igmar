import { GameModel } from '#models/game'
import { PlayerGameModel } from '#models/player_game'
import { Types } from 'mongoose'
import { toObjectId } from '../utils/utils.js'
import User from '../models/user.js'

// Cartas de la lotería mexicana (54 cartas tradicionales)
const LOTERIA_CARDS = [
  'el_gallo',
  'el_diablito',
  'la_dama',
  'el_catrín',
  'el_paraguas',
  'la_sirena',
  'la_escalera',
  'la_botella',
  'el_barril',
  'el_árbol',
  'el_melón',
  'el_valiente',
  'el_gorrito',
  'la_muerte',
  'la_pera',
  'la_bandera',
  'el_bandolón',
  'el_violoncello',
  'la_garza',
  'el_pájaro',
  'la_mano',
  'la_bota',
  'la_luna',
  'el_cotorro',
  'el_borracho',
  'el_negrito',
  'el_corazón',
  'la_sandía',
  'el_tambor',
  'el_camarón',
  'las_jaras',
  'el_músico',
  'la_araña',
  'el_soldado',
  'la_estrella',
  'el_cazo',
  'el_mundo',
  'el_apache',
  'el_nopal',
  'el_alacrán',
  'la_rosa',
  'la_calavera',
  'la_campana',
  'el_cantarito',
  'el_venado',
  'el_sol',
  'la_corona',
  'la_chalupa',
  'el_pino',
  'el_pescado',
  'la_palma',
  'la_maceta',
  'el_arpa',
  'la_rana',
]

type CreateLoteriaGameOptions = {
  userIds: number[]
  code: string
  minPlayers: number
  maxPlayers: number
}

export class LoteriaService {
  private gameModel = GameModel.loteria
  private playerGameModel = PlayerGameModel.loteria
  private gameBaseModel = GameModel.base

  // ========================================
  // MÉTODOS DE CREACIÓN DE JUEGO
  // ========================================

  async createLoteriaGame({ userIds, code, minPlayers, maxPlayers }: CreateLoteriaGameOptions) {
    if (userIds.length !== 1) {
      throw new Error('La lotería debe ser creada por un solo usuario (anfitrión)')
    }

    if (minPlayers < 4 || maxPlayers > 16 || minPlayers > maxPlayers) {
      throw new Error('Mínimo 4 jugadores, máximo 16, y min <= max')
    }

    const hostUserId = userIds[0]

    // Crear el juego
    const game = await this.gameModel.create({
      code,
      gameType: 'loteria',
      status: 'waiting',
      hasStarted: false,
      currentTurnUserId: null,
      players: [],
      minPlayers,
      maxPlayers,
      hostUserId,
      drawnCards: [],
      availableCards: [...LOTERIA_CARDS], // Todas las cartas disponibles
    })

    // Crear el PlayerGame para el anfitrión
    const hostPlayerGame = await this.playerGameModel.create({
      userId: hostUserId,
      gameId: game._id,
      gameType: 'loteria',
      result: 'pending',
      ready: false,
      isHost: true,
      playerCard: [],
      cardGenerated: false,
      isSpectator: false,
    })

    // Agregar al anfitrión a la lista de jugadores
    game.players.push(hostPlayerGame._id)
    await this.gameModel.update_by_id(game._id.toString(), { players: game.players })

    return game
  }

  // ========================================
  // MÉTODOS DE UNIRSE AL JUEGO
  // ========================================

  async joinLoteriaGame(userId: number, code: string) {
    const game = await this.gameModel.find_one({ code, status: 'waiting' })
    if (!game) throw new Error('Partida no encontrada o no disponible para unirse')

    if (game.players.length >= game.maxPlayers) {
      throw new Error(`La partida ya tiene el máximo de ${game.maxPlayers} jugadores`)
    }

    // Verificar que el usuario no esté ya en la partida
    const existingPlayer = await this.playerGameModel.find_one({
      userId,
      gameId: game._id,
    })
    if (existingPlayer) throw new Error('Ya estás en esta partida')

    // Crear PlayerGame para el nuevo jugador
    const playerGame = await this.playerGameModel.create({
      userId,
      gameId: game._id,
      gameType: 'loteria',
      result: 'pending',
      ready: false,
      isHost: false,
      playerCard: [],
      cardGenerated: false,
      isSpectator: false,
    })

    // Agregar a la lista de jugadores
    game.players.push(playerGame._id)
    await this.gameModel.update_by_id(game._id.toString(), { players: game.players })

    return game
  }

  // ========================================
  // MÉTODOS DE SELECCIÓN DE CARTAS
  // ========================================

  async generatePlayerCard(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    if (game.status !== 'waiting' && game.status !== 'card_selection') {
      throw new Error('No se pueden generar cartas en este estado del juego')
    }

    const player = await this.playerGameModel.find_one({
      userId,
      gameId: game._id,
    })
    if (!player) throw new Error('No perteneces a esta partida')

    // Generar carta aleatoria de 4x4 (16 cartas únicas)
    const shuffledCards = [...LOTERIA_CARDS].sort(() => Math.random() - 0.5)
    const playerCard = shuffledCards.slice(0, 16)

    await this.playerGameModel.generateCard(player._id.toString(), playerCard)

    // Si el juego está en waiting, cambiar a card_selection
    if (game.status === 'waiting') {
      await this.gameModel.update_by_id(gameId, { status: 'card_selection' })
    }

    return {
      playerCard,
      message: 'Carta generada exitosamente',
    }
  }

  // ========================================
  // MÉTODOS DE LOBBY
  // ========================================

  async getLoteriaLobbyStatus(game: any, userId: number) {
    const players = await this.playerGameModel.findByGameId(game._id.toString())
    const users = await Promise.all(players.map((p) => User.find(p.userId)))

    const me = players.find((p) => p.userId === userId)
    if (!me) throw new Error('No perteneces a esta partida')

    return {
      gameId: game._id.toString(),
      code: game.code,
      status: game.status,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      currentPlayers: players.length,
      isHost: me.isHost,
      myCardGenerated: me.cardGenerated,
      myReady: me.ready,
      canStart: this.canStartGame(game, players),
      players: players.map((p, idx) => ({
        userId: p.userId,
        ready: p.ready,
        cardGenerated: p.cardGenerated,
        isHost: p.isHost,
        user: users[idx]
          ? {
              id: users[idx].id,
              name: users[idx].name,
              level: users[idx].level,
              exp: users[idx].exp,
            }
          : undefined,
      })),
    }
  }

  private canStartGame(game: any, players: any[]) {
    return players.length >= game.minPlayers && players.every((p) => p.ready && p.cardGenerated)
  }

  // ========================================
  // MÉTODOS DE INICIO DE JUEGO
  // ========================================

  async startLoteriaGame(game: any, userId: number) {
    const players = await this.playerGameModel.findByGameId(game._id.toString())

    // Verificar que el usuario sea el anfitrión
    const host = players.find((p) => p.isHost)
    if (!host || host.userId !== userId) {
      throw new Error('Solo el anfitrión puede iniciar la partida')
    }

    // Verificar condiciones para iniciar
    if (!this.canStartGame(game, players)) {
      throw new Error(
        'No se puede iniciar: faltan jugadores, cartas por generar o jugadores por estar listos'
      )
    }

    // Cambiar estado a in_progress
    await this.gameModel.update_by_id(game._id.toString(), {
      status: 'in_progress',
      hasStarted: true,
    })

    return {
      message: 'Partida de lotería iniciada exitosamente',
      status: 'in_progress',
    }
  }

  // ========================================
  // MÉTODOS DE JUEGO EN PROGRESO
  // ========================================

  async getLoteriaGameStatus(game: any, userId: number) {
    const players = await this.playerGameModel.findByGameId(game._id.toString())
    const me = players.find((p) => p.userId === userId)
    if (!me) throw new Error('No perteneces a esta partida')

    const users = await Promise.all(players.map((p) => User.find(p.userId)))

    // Estado base para todos los jugadores
    const baseStatus = {
      gameId: game._id.toString(),
      status: game.status,
      currentCard: game.currentCard,
      myCard: me.playerCard,
      myMarkedCells: me.markedCells,
      myTokensUsed: me.tokensUsed,
      totalTokens: me.totalTokens,
      isSpectator: me.isSpectator,
      isHost: me.isHost,
      playerUnderReview: game.playerUnderReview,
      drawnCardsCount: game.drawnCards.length,
    }

    // Si es anfitrión, información adicional
    if (me.isHost) {
      return {
        ...baseStatus,
        hostView: {
          availableCardsCount: game.availableCards.length,
          drawnCards: game.drawnCards,
          canDraw: game.availableCards.length > 0 && !game.currentCard,
          canReshuffle: game.drawnCards.length > 0,
          playersInfo: players.map((p, idx) => ({
            userId: p.userId,
            playerCard: p.playerCard,
            markedCells: p.markedCells,
            tokensUsed: p.tokensUsed,
            isSpectator: p.isSpectator,
            claimedWin: p.claimedWin,
            user: users[idx]
              ? {
                  id: users[idx].id,
                  name: users[idx].name,
                }
              : undefined,
          })),
        },
      }
    }

    // Vista normal para jugadores
    return {
      ...baseStatus,
      playersInfo: players
        .filter((p) => !p.isHost)
        .map((p, idx) => ({
          userId: p.userId,
          tokensUsed: p.tokensUsed,
          isSpectator: p.isSpectator,
          claimedWin: p.claimedWin,
          user: users[idx]
            ? {
                id: users[idx].id,
                name: users[idx].name,
              }
            : undefined,
        })),
    }
  }

  // ========================================
  // MÉTODOS DEL ANFITRIÓN
  // ========================================

  async drawCard(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    if (game.status !== 'in_progress') {
      throw new Error('El juego no está en progreso')
    }

    // Verificar que sea el anfitrión
    const host = await this.playerGameModel.find_one({
      userId,
      gameId: game._id,
      isHost: true,
    })
    if (!host) throw new Error('Solo el anfitrión puede sacar cartas')

    if (game.availableCards.length === 0) {
      throw new Error('No hay cartas disponibles')
    }

    if (game.currentCard) {
      throw new Error('Ya hay una carta activa, debe ser procesada primero')
    }

    // Sacar carta aleatoria
    const randomIndex = Math.floor(Math.random() * game.availableCards.length)
    const drawnCard = game.availableCards[randomIndex]

    await this.gameModel.drawCard(gameId, drawnCard)

    return {
      drawnCard,
      message: `Carta sacada: ${drawnCard}`,
    }
  }

  async reshuffleCards(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    // Verificar que sea el anfitrión
    const host = await this.playerGameModel.find_one({
      userId,
      gameId: game._id,
      isHost: true,
    })
    if (!host) throw new Error('Solo el anfitrión puede rebarajear')

    if (game.drawnCards.length === 0) {
      throw new Error('No hay cartas para rebarajear')
    }

    // Rebarajear: devolver todas las cartas sacadas al mazo
    await this.gameModel.reshuffleCards(gameId, [...LOTERIA_CARDS])

    return {
      message: 'Cartas rebarajeadas exitosamente',
      availableCards: LOTERIA_CARDS.length,
    }
  }

  // ========================================
  // MÉTODOS DE LOS JUGADORES
  // ========================================

  async placeToken(gameId: string, userId: number, cellIndex: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    if (game.status !== 'in_progress') {
      throw new Error('El juego no está en progreso')
    }

    const player = await this.playerGameModel.find_one({
      userId,
      gameId: game._id,
    })
    if (!player) throw new Error('No perteneces a esta partida')

    if (player.isSpectator) {
      throw new Error('Estás en modo espectador y no puedes colocar fichas')
    }

    if (cellIndex < 0 || cellIndex > 15) {
      throw new Error('Índice de celda inválido (0-15)')
    }

    if (player.markedCells[cellIndex]) {
      throw new Error('Esta celda ya está marcada')
    }

    // Verificar que la carta en esa posición coincida con la carta actual
    const cardInCell = player.playerCard[cellIndex]
    if (cardInCell !== game.currentCard) {
      throw new Error('La carta en esta posición no coincide con la carta actual')
    }

    // Marcar la celda
    await this.playerGameModel.markCell(player._id.toString(), cellIndex)

    const updatedPlayer = await this.playerGameModel.find_by_id(player._id.toString())

    if (!updatedPlayer) {
      throw new Error('Jugador no encontrado después de marcar la celda')
    }
    const tokensUsed = updatedPlayer.tokensUsed

    return {
      cellIndex,
      tokensUsed,
      message: 'Ficha colocada exitosamente',
    }
  }

  async claimWin(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    if (game.status !== 'in_progress') {
      throw new Error('El juego no está en progreso')
    }

    const player = await this.playerGameModel.find_one({
      userId,
      gameId: game._id,
    })
    if (!player) throw new Error('No perteneces a esta partida')

    if (player.isSpectator) {
      throw new Error('Estás en modo espectador y no puedes reclamar victoria')
    }

    // Verificar que tenga la carta llena (16 fichas)
    if (player.tokensUsed < 16) {
      throw new Error('No tienes la carta completa para reclamar victoria')
    }

    // Reclamar victoria
    await this.playerGameModel.claimWin(player._id.toString())

    // Cambiar estado del juego a verificación
    await this.gameModel.startReview(gameId, userId)

    // Verificar automáticamente
    const isValid = await this.verifyWin(gameId, userId)

    return {
      claimed: true,
      isValid,
      message: isValid ? '¡Ganaste la partida!' : 'Reclamación inválida - modo espectador',
    }
  }

  // ========================================
  // MÉTODOS DE VERIFICACIÓN
  // ========================================

  private async verifyWin(gameId: string, userId: number): Promise<boolean> {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    const player = await this.playerGameModel.find_one({
      userId,
      gameId: game._id,
    })
    if (!player) throw new Error('Jugador no encontrado')

    // Verificar que todas las cartas marcadas estén en las cartas sacadas
    const markedCards = player.playerCard.filter((card, index) => player.markedCells[index])
    const allCardsValid = markedCards.every((card) => game.drawnCards.includes(card))

    if (allCardsValid && markedCards.length === 16) {
      // Victoria válida
      await this.playerGameModel.setVerificationResult(player._id.toString(), 'valid')

      // Actualizar resultado del jugador
      await this.playerGameModel.update_by_id(player._id.toString(), { result: 'win' })

      // Marcar a todos los demás como perdedores
      const allPlayers = await this.playerGameModel.findByGameId(gameId)
      for (const otherPlayer of allPlayers) {
        if (otherPlayer.userId !== userId) {
          await this.playerGameModel.update_by_id(otherPlayer._id.toString(), { result: 'lose' })
        }
      }

      // Terminar el juego
      await this.gameModel.endReview(gameId, true)
      await this.gameModel.update_by_id(gameId, { winner: userId })

      return true
    } else {
      // Victoria inválida - falta
      await this.playerGameModel.setVerificationResult(player._id.toString(), 'invalid')

      // Continuar el juego
      await this.gameModel.endReview(gameId, false)

      return false
    }
  }

  // ========================================
  // MÉTODOS DE UTILIDAD
  // ========================================

  async processCurrentCard(gameId: string) {
    // Limpiar la carta actual para permitir sacar la siguiente
    await this.gameModel.update_by_id(gameId, { currentCard: undefined })

    return {
      message: 'Carta procesada, se puede sacar la siguiente',
    }
  }
}
