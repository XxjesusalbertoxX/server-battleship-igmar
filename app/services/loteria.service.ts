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
  drawCooldownSeconds?: number // NUEVO: Tiempo de espera entre sorteos
}

export class LoteriaService {
  private gameModel = GameModel.loteria
  private playerGameModel = PlayerGameModel.loteria
  private gameBaseModel = GameModel.base

  // ========================================
  // MÉTODOS DE CREACIÓN DE JUEGO
  // ========================================

  async createLoteriaGame({
    userIds,
    code,
    minPlayers,
    maxPlayers,
    drawCooldownSeconds,
  }: CreateLoteriaGameOptions) {
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
      drawCooldownSeconds: drawCooldownSeconds || 2, // NUEVO
      drawnCards: [],
      availableCards: [...LOTERIA_CARDS],
    })

    // Crear el PlayerGame para el anfitrión (pero NO agregarlo a players)
    await this.playerGameModel.create({
      userId: hostUserId,
      gameId: game._id,
      gameType: 'loteria',
      result: 'pending',
      ready: true, // Anfitrión siempre está "listo"
      isHost: true,
      playerCard: [], // No tiene carta
      cardGenerated: true, // Marcado como generado para no causar problemas
      isSpectator: false,
    })

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

    // El anfitrión NO puede generar carta
    if (player.isHost) {
      throw new Error('El anfitrión no puede generar cartas')
    }

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
    const allPlayerGames = await this.playerGameModel.findByGameId(game._id.toString())
    const users = await Promise.all(allPlayerGames.map((p) => User.find(p.userId)))

    const me = allPlayerGames.find((p) => p.userId === userId)
    if (!me) throw new Error('No perteneces a esta partida')

    // Separar anfitrión de jugadores normales
    const host = allPlayerGames.find((p) => p.isHost)
    const normalPlayers = allPlayerGames.filter((p) => !p.isHost)

    return {
      gameId: game._id.toString(),
      code: game.code,
      status: game.status,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      currentPlayers: normalPlayers.length, // Solo contar jugadores normales
      isHost: me.isHost,
      myCardGenerated: me.cardGenerated,
      myReady: me.ready,
      canStart: this.canStartGame(game, normalPlayers), // Solo validar jugadores normales
      host: host
        ? {
            userId: host.userId,
            user: users.find((u) => u?.id === host.userId)
              ? {
                  id: users.find((u) => u?.id === host.userId)!.id,
                  name: users.find((u) => u?.id === host.userId)!.name,
                  level: users.find((u) => u?.id === host.userId)!.level,
                  exp: users.find((u) => u?.id === host.userId)!.exp,
                }
              : undefined,
          }
        : undefined,
      players: normalPlayers.map((p) => ({
        userId: p.userId,
        ready: p.ready,
        cardGenerated: p.cardGenerated,
        isHost: false,
        user: users.find((u) => u?.id === p.userId)
          ? {
              id: users.find((u) => u?.id === p.userId)!.id,
              name: users.find((u) => u?.id === p.userId)!.name,
              level: users.find((u) => u?.id === p.userId)!.level,
              exp: users.find((u) => u?.id === p.userId)!.exp,
            }
          : undefined,
      })),
    }
  }

  private canStartGame(game: any, normalPlayers: any[]) {
    return (
      normalPlayers.length >= game.minPlayers &&
      normalPlayers.every((p) => p.ready && p.cardGenerated)
    )
  }

  // ========================================
  // MÉTODOS DE INICIO DE JUEGO
  // ========================================

  async startLoteriaGame(game: any, userId: number) {
    const allPlayerGames = await this.playerGameModel.findByGameId(game._id.toString())
    const normalPlayers = allPlayerGames.filter((p) => !p.isHost)

    // Verificar que el usuario sea el anfitrión
    const host = allPlayerGames.find((p) => p.isHost)
    if (!host || host.userId !== userId) {
      throw new Error('Solo el anfitrión puede iniciar la partida')
    }

    // Verificar condiciones para iniciar (solo jugadores normales)
    if (!this.canStartGame(game, normalPlayers)) {
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

  // ========================================
  // MÉTODOS DEL ANFITRIÓN - CORREGIDOS
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

    // VALIDAR COOLDOWN
    const now = Date.now()
    const cooldown = game.drawCooldownSeconds! * 1000
    if (game.lastDrawAt && now - new Date(game.lastDrawAt).getTime() < cooldown) {
      const waitSeconds = Math.ceil((cooldown - (now - new Date(game.lastDrawAt).getTime())) / 1000)
      throw new Error(`Debes esperar ${waitSeconds} segundos para sacar otra carta`)
    }

    if (game.availableCards.length === 0) {
      throw new Error('No hay cartas disponibles en el mazo')
    }

    // Sacar la primera carta del mazo
    const drawnCard = game.availableCards[0]

    // Actualizar el estado con timestamp
    await this.gameModel.update_by_id(gameId, {
      currentCard: drawnCard,
      drawnCards: [...game.drawnCards, drawnCard],
      availableCards: game.availableCards.slice(1),
      lastDrawAt: new Date(), // NUEVO - Guardar timestamp
    })

    return {
      drawnCard,
      message: `Carta sacada: ${drawnCard}`,
      cardsRemaining: game.availableCards.length - 1,
      nextCardIn: game.drawCooldownSeconds, // Info para el frontend
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

    // REBARAJEAR: solo las cartas que quedan en el mazo (no las que ya salieron)
    const shuffledAvailableCards = [...game.availableCards].sort(() => Math.random() - 0.5)

    await this.gameModel.reshuffleCards(gameId, shuffledAvailableCards)

    return {
      message: 'Cartas rebarajeadas exitosamente',
      availableCards: shuffledAvailableCards.length, // Cantidad real de cartas disponibles
      cardsRemaining: shuffledAvailableCards.length,
    }
  }

  // ========================================
  // MÉTODOS DE JUEGO EN PROGRESO - MEJORADOS
  // ========================================

  async getLoteriaGameStatus(game: any, userId: number) {
    const players = await this.playerGameModel.findByGameId(game._id.toString())
    const me = players.find((p) => p.userId === userId)
    if (!me) throw new Error('No perteneces a esta partida')

    const users = await Promise.all(players.map((p) => User.find(p.userId)))

    // Estado base para todos
    const baseStatus = {
      gameId: game._id.toString(),
      status: game.status,
      currentCard: game.currentCard, // Última carta sacada (todos la ven)
      isHost: me.isHost,
      playerUnderReview: game.playerUnderReview,
      cardsRemaining: game.availableCards.length, // Solo cantidad, no las cartas
    }

    // Si el juego terminó, mostrar las cartas restantes (tradicional de lotería)
    if (game.status === 'finished') {
      return {
        ...baseStatus,
        remainingCards: game.availableCards, // Al final sí se muestran
        gameOver: true,
        winner: game.winner,
        // Solo el anfitrión ve las cartas de todos al final
        ...(me.isHost && {
          finalPlayersCards: players
            .filter((p) => !p.isHost)
            .map((p, idx) => ({
              userId: p.userId,
              playerCard: p.playerCard,
              markedCells: p.markedCells,
              tokensUsed: p.tokensUsed,
              user: users[idx]
                ? {
                    id: users[idx].id,
                    name: users[idx].name,
                  }
                : undefined,
            })),
        }),
      }
    }

    // ========================================
    // VISTA DEL ANFITRIÓN
    // ========================================
    if (me.isHost) {
      return {
        ...baseStatus,
        // Anfitrión NO tiene carta propia
        // myCard: [],
        // myMarkedCells: [],
        // myTokensUsed: 0,
        // totalTokens: 0,

        hostView: {
          // PUEDE ver las cartas de todos los jugadores (para validar)
          playersCards: players
            .filter((p) => !p.isHost) // Solo jugadores normales
            .map((p, idx) => ({
              userId: p.userId,
              playerCard: p.playerCard, // ✅ VE las cartas de los jugadores
              markedCells: p.markedCells, // ✅ VE las fichas marcadas
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

          // Control de la partida
          canDraw: game.availableCards.length > 0,
          canReshuffle: true,

          // ❌ NO ve las cartas que quedan en el mazo
          // ❌ NO ve el historial de cartas sacadas
          // Solo ve la cantidad de cartas restantes
          cardsInDeck: game.availableCards.length,
        },
      }
    }

    // ========================================
    // VISTA DE JUGADORES NORMALES
    // ========================================
    return {
      ...baseStatus,
      // Solo ve SU propia carta
      myCard: me.playerCard,
      isSpectator: me.isSpectator,
      myMarkedCells: me.markedCells,
      myTokensUsed: me.tokensUsed,
      totalTokens: me.totalTokens || 16,

      // Solo ve información básica de otros jugadores (sin sus cartas)
      playersInfo: players
        .filter((p) => !p.isHost && p.userId !== userId) // Otros jugadores (sin anfitrión)
        .map((p, idx) => ({
          userId: p.userId,
          tokensUsed: p.tokensUsed, // Cuántas fichas han puesto
          isSpectator: p.isSpectator,
          claimedWin: p.claimedWin,
          user: users[idx]
            ? {
                id: users[idx].id,
                name: users[idx].name,
              }
            : undefined,
          // ❌ NO ven las cartas de otros jugadores
        })),
    }
  }

  // ========================================
  // MÉTODOS DE LOS JUGADORES
  // ========================================

  async placeToken(gameId: string, userId: number, row: number, col: number) {
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

    if (player.isHost) {
      throw new Error('El anfitrión no puede colocar fichas')
    }
    if (player.isSpectator) {
      throw new Error('Estás en modo espectador y no puedes colocar fichas')
    }

    // Validar coordenadas de la matriz 4x4
    if (row < 0 || row > 3 || col < 0 || col > 3) {
      throw new Error('Coordenadas inválidas (0-3 para fila y columna)')
    }

    // Convertir matriz 4x4 a índice lineal para el array
    const cellIndex = row * 4 + col

    if (player.markedCells[cellIndex]) {
      throw new Error('Esta celda ya está marcada')
    }

    // PERMITIR colocar ficha sin validar si la carta ya salió
    // (La validación se hace al final cuando reclama victoria)
    await this.playerGameModel.markCell(player._id.toString(), cellIndex)

    const updatedPlayer = await this.playerGameModel.find_by_id(player._id.toString())
    if (!updatedPlayer) {
      throw new Error('Jugador no encontrado después de marcar la celda')
    }

    const tokensUsed = updatedPlayer.tokensUsed

    // AUTO CLAIM - Si completó la carta (16 fichas), reclamar automáticamente
    if (tokensUsed === 16) {
      // Reclamar victoria automáticamente
      await this.playerGameModel.claimWin(updatedPlayer._id.toString())
      await this.gameModel.startReview(gameId, userId)

      // Verificar automáticamente si realmente ganó o hizo trampa
      const isValid = await this.verifyWin(gameId, userId)

      return {
        row,
        col,
        cellIndex,
        tokensUsed,
        autoClaimWin: true,
        isValid,
        message: isValid
          ? '¡Tablero completo! ¡Ganaste la partida!'
          : 'Tablero completo pero hiciste trampa - modo espectador',
      }
    }

    return {
      row,
      col,
      cellIndex,
      tokensUsed,
      autoClaimWin: false,
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
      // ✅ VICTORIA VÁLIDA
      await this.playerGameModel.setVerificationResult(player._id.toString(), 'valid')
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
      await this.gameModel.update_by_id(gameId, {
        winner: userId,
        status: 'finished',
      })

      return true
    } else {
      // ❌ VICTORIA INVÁLIDA - TRAMPA/FALTA
      await this.playerGameModel.setVerificationResult(player._id.toString(), 'invalid')

      // BANEAR: Marcar como espectador (no puede hacer más acciones)
      await this.playerGameModel.update_by_id(player._id.toString(), {
        isSpectator: true,
        result: 'lose',
        claimedWin: false, // Reset claim
      })

      // Continuar el juego
      await this.gameModel.endReview(gameId, false)

      return false
    }
  }

  async kickPlayer(gameId: string, hostUserId: number, kickUserId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    if (game.status !== 'waiting' && game.status !== 'card_selection') {
      throw new Error('Solo se puede expulsar jugadores en el lobby')
    }

    // Verificar que quien expulsa sea el anfitrión
    const host = await this.playerGameModel.find_one({
      userId: hostUserId,
      gameId: game._id,
      isHost: true,
    })
    if (!host) throw new Error('Solo el anfitrión puede expulsar jugadores')

    // Buscar al jugador a expulsar
    const playerToKick = await this.playerGameModel.find_one({
      userId: kickUserId,
      gameId: game._id,
      isHost: false, // No se puede expulsar al anfitrión
    })
    if (!playerToKick) throw new Error('Jugador no encontrado o no se puede expulsar')

    // Quitar del array de players del juego
    game.players = game.players.filter((id) => id.toString() !== playerToKick._id.toString())
    await this.gameModel.update_by_id(gameId, { players: game.players })

    // Borrar el PlayerGame
    await this.playerGameModel.delete_by_id(playerToKick._id.toString())

    // Si no quedan jugadores normales, volver a waiting
    if (game.players.length === 0) {
      await this.gameModel.update_by_id(gameId, { status: 'waiting' })
    }

    return {
      kicked: true,
      kickedUserId: kickUserId,
      message: `Jugador ${kickUserId} expulsado de la partida`,
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
