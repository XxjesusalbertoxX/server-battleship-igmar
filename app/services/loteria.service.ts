import { GameModel } from '#models/game'
import { PlayerGameModel } from '#models/player_game'
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
  drawCooldownSeconds?: number
}

export class LoteriaService {
  private gameModel = GameModel.loteria
  private playerGameModel = PlayerGameModel.loteria

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

    // Crear el juego con todos los campos necesarios
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
      drawCooldownSeconds: drawCooldownSeconds || 2,
      drawnCards: [],
      availableCards: [...LOTERIA_CARDS],
      bannedPlayers: [], // NUEVO: Lista de jugadores baneados
      playerUnderReview: undefined, // NUEVO: Jugador siendo verificado
      winners: [], // NUEVO: Lista de ganadores
      losers: [], // NUEVO: Lista de perdedores
      lastDrawAt: undefined, // NUEVO: Timestamp del último sorteo
    })

    // Crear el PlayerGame para el anfitrión
    await this.playerGameModel.create({
      userId: hostUserId,
      gameId: game._id,
      gameType: 'loteria',
      result: 'pending',
      ready: true,
      isHost: true,
      playerCard: [],
      cardGenerated: true,
      isSpectator: false,
      markedCells: Array(16).fill(false),
      tokensUsed: 0,
      totalTokens: 0, // Anfitrión no tiene fichas
      claimedWin: false,
      verificationResult: null,
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

    const existingPlayer = await this.playerGameModel.find_one({
      userId,
      gameId: game._id,
    })
    if (existingPlayer) throw new Error('Ya estás en esta partida')

    // Crear PlayerGame con todos los campos
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
      markedCells: Array(16).fill(false),
      tokensUsed: 0,
      totalTokens: 16,
      claimedWin: false,
      verificationResult: null,
    })

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

    if (player.isHost) {
      throw new Error('El anfitrión no puede generar cartas')
    }

    // Generar carta aleatoria de 4x4 (16 cartas únicas)
    const shuffledCards = [...LOTERIA_CARDS].sort(() => Math.random() - 0.5)
    const playerCard = shuffledCards.slice(0, 16)

    await this.playerGameModel.generateCard(player._id.toString(), playerCard)

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

    const host = allPlayerGames.find((p) => p.isHost)
    const normalPlayers = allPlayerGames.filter((p) => !p.isHost)

    return {
      gameId: game._id.toString(),
      code: game.code,
      status: game.status,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      currentPlayers: normalPlayers.length,
      isHost: me.isHost,
      myCardGenerated: me.cardGenerated,
      myReady: me.ready,
      canStart: this.canStartGame(game, normalPlayers),
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

    const host = allPlayerGames.find((p) => p.isHost)
    if (!host || host.userId !== userId) {
      throw new Error('Solo el anfitrión puede iniciar la partida')
    }

    if (!this.canStartGame(game, normalPlayers)) {
      throw new Error(
        'No se puede iniciar: faltan jugadores, cartas por generar o jugadores por estar listos'
      )
    }

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
  // MÉTODOS DEL ANFITRIÓN
  // ========================================

  async drawCard(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    if (game.status !== 'in_progress') {
      throw new Error('El juego no está en progreso')
    }

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

    const drawnCard = game.availableCards[0]

    await this.gameModel.update_by_id(gameId, {
      currentCard: drawnCard,
      drawnCards: [...game.drawnCards, drawnCard],
      availableCards: game.availableCards.slice(1),
      lastDrawAt: new Date(),
    })

    return {
      drawnCard,
      message: `Carta sacada: ${drawnCard}`,
      cardsRemaining: game.availableCards.length - 1,
      nextCardIn: game.drawCooldownSeconds,
    }
  }

  // ...existing code...

  // NUEVO: Método específico para manejar abandono en lotería
  async handlePlayerLeave(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    const player = await this.playerGameModel.find_one({
      userId,
      gameId: game._id,
    })
    if (!player) throw new Error('No perteneces a esta partida')

    const userInfo = await User.find(userId)
    const playerName = userInfo?.name || 'Jugador desconocido'

    if (player.isHost) {
      // ANFITRIÓN ABANDONA - TERMINAR PARTIDA
      await this.gameModel.update_by_id(gameId, {
        status: 'finished',
        winner: undefined,
      })

      // Marcar a todos como perdedores
      const allPlayers = await this.playerGameModel.findByGameId(gameId)
      for (const p of allPlayers) {
        await this.playerGameModel.update_by_id(p._id.toString(), {
          result: 'lose',
        })
      }

      return {
        message: `El anfitrión ${playerName} abandonó. Partida terminada.`,
        gameEnded: true,
      }
    } else {
      // JUGADOR NORMAL - SOLO ESPECTADOR
      await this.playerGameModel.update_by_id(player._id.toString(), {
        result: 'lose',
        isSpectator: true,
        claimedWin: false,
        // Mantener sus fichas y carta para que pueda seguir viendo
      })

      // Agregar a abandonados
      const bannedPlayers = game.bannedPlayers || []
      const abandonedLabel = `${playerName} (abandonó)`
      if (!bannedPlayers.some((banned) => banned.includes(playerName))) {
        bannedPlayers.push(abandonedLabel)
      }

      await this.gameModel.update_by_id(gameId, {
        bannedPlayers,
        // NO cambiar status - la partida continúa
      })

      // VERIFICAR: Si solo queda 1 jugador activo, terminar la partida
      const allPlayers = await this.playerGameModel.findByGameId(gameId)
      const activePlayers = allPlayers.filter(
        (p) => !p.isHost && !p.isSpectator && p.result === 'pending'
      )

      if (activePlayers.length === 1) {
        // Solo queda 1 jugador - terminar y declarar ganador
        const lastPlayer = activePlayers[0]
        const lastUser = await User.find(lastPlayer.userId)

        await this.playerGameModel.update_by_id(lastPlayer._id.toString(), {
          result: 'win',
        })

        await this.gameModel.update_by_id(gameId, {
          status: 'finished',
          winner: lastPlayer.userId,
          winners: [lastUser?.name || 'Jugador'],
        })

        return {
          message: `${playerName} abandonó. ${lastUser?.name || 'El último jugador'} gana por ser el único restante.`,
          gameEnded: true,
          winnerByDefault: true,
        }
      }

      return {
        message: `${playerName} abandonó y ahora es espectador. La partida continúa.`,
        gameEnded: false,
      }
    }
  }

  // ...existing code...

  async reshuffleCards(gameId: string, userId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    const host = await this.playerGameModel.find_one({
      userId,
      gameId: game._id,
      isHost: true,
    })
    if (!host) throw new Error('Solo el anfitrión puede rebarajear')

    const shuffledAvailableCards = [...game.availableCards].sort(() => Math.random() - 0.5)

    await this.gameModel.reshuffleCards(gameId, shuffledAvailableCards)

    return {
      message: 'Cartas rebarajeadas exitosamente',
      availableCards: shuffledAvailableCards.length,
      cardsRemaining: shuffledAvailableCards.length,
    }
  }

  // ========================================
  // MÉTODOS DE JUEGO EN PROGRESO - COMPLETOS
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
      currentCard: game.currentCard,
      isHost: me.isHost,
      playerUnderReview: game.playerUnderReview,
      cardsRemaining: game.availableCards.length,
      // NUEVO: Campos adicionales según los modelos
      bannedPlayers: game.bannedPlayers || [],
      winners: game.winners || [],
      losers: game.losers || [],
    }

    // ========================================
    // JUEGO TERMINADO - INFORMACIÓN COMPLETA
    // ========================================
    if (game.status === 'finished') {
      const winnerUser = game.winner ? await User.find(game.winner) : null

      // Obtener nombres de ganadores y perdedores
      const winnerNames = []
      const loserNames = []

      for (const player of players.filter((p) => !p.isHost)) {
        const user = users.find((u) => u?.id === player.userId)
        const userName = user?.name || 'Jugador desconocido'

        if (player.result === 'win') {
          winnerNames.push(userName)
        } else if (player.result === 'lose') {
          loserNames.push(userName)
        }
      }

      // Obtener nombres de jugadores baneados
      const bannedPlayerNames = []
      for (const player of players.filter((p) => p.isSpectator && !p.isHost)) {
        const user = users.find((u) => u?.id === player.userId)
        if (user) {
          bannedPlayerNames.push(user.name)
        }
      }

      return {
        ...baseStatus,
        status: 'finished' as const,
        remainingCards: game.availableCards,
        finalRemainingCards: game.availableCards, // Alias para compatibilidad
        gameOver: true,
        winner: game.winner,
        winnerName: winnerUser?.name || 'Desconocido',
        winners: winnerNames,
        losers: loserNames,
        bannedPlayers: bannedPlayerNames,
        // Solo el anfitrión ve las cartas de todos al final
        ...(me.isHost && {
          finalPlayersCards: players
            .filter((p) => !p.isHost)
            .map((p) => {
              const user = users.find((u) => u?.id === p.userId)
              return {
                userId: p.userId,
                playerCard: p.playerCard,
                markedCells: p.markedCells,
                tokensUsed: p.tokensUsed,
                isSpectator: p.isSpectator,
                claimedWin: p.claimedWin,
                user: user
                  ? {
                      id: user.id,
                      name: user.name,
                    }
                  : undefined,
              }
            }),
        }),
      }
    }

    // ========================================
    // VISTA DEL ANFITRIÓN
    // ========================================
    if (me.isHost) {
      return {
        ...baseStatus,
        isHost: true as const,
        hostView: {
          playersCards: players
            .filter((p) => !p.isHost)
            .map((p) => {
              const user = users.find((u) => u?.id === p.userId)
              return {
                userId: p.userId,
                playerCard: p.playerCard,
                markedCells: p.markedCells,
                tokensUsed: p.tokensUsed,
                isSpectator: p.isSpectator,
                claimedWin: p.claimedWin,
                user: user
                  ? {
                      id: user.id,
                      name: user.name,
                    }
                  : undefined,
              }
            }),
          canDraw: game.availableCards.length > 0,
          canReshuffle: true,
          cardsInDeck: game.availableCards.length,
        },
      }
    }

    // ========================================
    // VISTA DE JUGADORES NORMALES
    // ========================================
    return {
      ...baseStatus,
      userId: me.userId,
      name: users.find((u) => u?.id === me.userId)?.name || 'Jugador',
      isHost: false as const,
      isSpectator: me.isSpectator,
      tokensUsed: me.tokensUsed,
      myCard: me.playerCard,
      myMarkedCells: me.markedCells,
      result: me.result,
      isBanned: me.isSpectator, // Si es espectador, probablemente fue baneado
      user: {
        id: me.userId,
        name: users.find((u) => u?.id === me.userId)?.name || 'Jugador',
        wins: users.find((u) => u?.id === me.userId)?.wins || 0,
        losses: users.find((u) => u?.id === me.userId)?.losses || 0,
        level: users.find((u) => u?.id === me.userId)?.level || 1,
        exp: users.find((u) => u?.id === me.userId)?.exp || 0,
      },
      playersInfo: players
        .filter((p) => !p.isHost && p.userId !== userId)
        .map((p) => {
          const user = users.find((u) => u?.id === p.userId)
          return {
            userId: p.userId,
            tokensUsed: p.tokensUsed,
            isSpectator: p.isSpectator,
            claimedWin: p.claimedWin,
            user: user
              ? {
                  id: user.id,
                  name: user.name,
                }
              : undefined,
          }
        }),
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

    if (row < 0 || row > 3 || col < 0 || col > 3) {
      throw new Error('Coordenadas inválidas (0-3 para fila y columna)')
    }

    const cellIndex = row * 4 + col

    if (player.markedCells[cellIndex]) {
      throw new Error('Esta celda ya está marcada')
    }

    await this.playerGameModel.markCell(player._id.toString(), cellIndex)

    const updatedPlayer = await this.playerGameModel.find_by_id(player._id.toString())
    if (!updatedPlayer) {
      throw new Error('Jugador no encontrado después de marcar la celda')
    }

    const tokensUsed = updatedPlayer.tokensUsed

    // AUTO CLAIM - Si completó la carta (16 fichas), reclamar automáticamente
    if (tokensUsed === 16) {
      await this.playerGameModel.claimWin(updatedPlayer._id.toString())
      await this.gameModel.startReview(gameId, userId)

      const userInfo = await User.find(userId)
      const isValid = await this.verifyWin(gameId, userId)

      return {
        row,
        col,
        cellIndex,
        tokensUsed,
        autoClaimWin: true,
        isValid,
        isCheater: !isValid,
        playerName: userInfo?.name || 'Jugador',
        message: isValid
          ? '¡Tablero completo! ¡Ganaste la partida!'
          : 'Tablero completo pero hiciste trampa - ahora eres espectador',
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

    if (player.tokensUsed < 16) {
      throw new Error('No tienes la carta completa para reclamar victoria')
    }

    await this.playerGameModel.claimWin(player._id.toString())
    await this.gameModel.startReview(gameId, userId)

    const isValid = await this.verifyWin(gameId, userId)
    const userInfo = await User.find(userId)

    return {
      claimed: true,
      isValid,
      isCheater: !isValid,
      playerName: userInfo?.name || 'Jugador',
      message: isValid ? '¡Ganaste la partida!' : 'Reclamación inválida - ahora eres espectador',
    }
  }

  // ========================================
  // MÉTODOS DE VERIFICACIÓN - MEJORADOS
  // ========================================

  private async verifyWin(gameId: string, userId: number): Promise<boolean> {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    const player = await this.playerGameModel.find_one({
      userId,
      gameId: game._id,
    })
    if (!player) throw new Error('Jugador no encontrado')

    // DEPURACIÓN: Log para ver qué está pasando
    console.log('=== VERIFICACIÓN DE VICTORIA ===')
    console.log('Cartas del jugador:', player.playerCard)
    console.log('Celdas marcadas:', player.markedCells)
    console.log('Cartas sacadas:', game.drawnCards)
    console.log('Tokens usados:', player.tokensUsed)

    // Obtener solo las cartas marcadas (donde markedCells[i] === true)
    const markedCards = player.playerCard.filter((_card, index) => player.markedCells[index])
    console.log('Cartas marcadas por el jugador:', markedCards)

    // Verificar que TODAS las cartas marcadas están en drawnCards
    const allCardsValid = markedCards.every((card) => {
      const isValid = game.drawnCards.includes(card)
      console.log(`Carta ${card}: ${isValid ? 'VÁLIDA' : 'INVÁLIDA'}`)
      return isValid
    })

    console.log('Todas las cartas válidas:', allCardsValid)
    console.log('Cantidad de cartas marcadas:', markedCards.length)
    console.log('=============================')

    if (allCardsValid && markedCards.length === 16) {
      // ✅ VICTORIA VÁLIDA
      await this.playerGameModel.setVerificationResult(player._id.toString(), 'valid')
      await this.playerGameModel.update_by_id(player._id.toString(), { result: 'win' })

      const userInfo = await User.find(userId)
      const winnerName = userInfo?.name || 'Jugador desconocido'

      // Marcar a todos los demás como perdedores
      const allPlayers = await this.playerGameModel.findByGameId(gameId)
      const loserNames = []

      for (const otherPlayer of allPlayers) {
        if (otherPlayer.userId !== userId && !otherPlayer.isHost) {
          await this.playerGameModel.update_by_id(otherPlayer._id.toString(), { result: 'lose' })
          const otherUser = await User.find(otherPlayer.userId)
          if (otherUser) {
            loserNames.push(otherUser.name)
          }
        }
      }

      // Terminar el juego con toda la información
      await this.gameModel.endReview(gameId, true)
      await this.gameModel.update_by_id(gameId, {
        winner: userId,
        status: 'finished',
        winners: [winnerName],
        losers: loserNames,
      })

      return true
    } else {
      // ❌ VICTORIA INVÁLIDA - TRAMPA
      await this.playerGameModel.setVerificationResult(player._id.toString(), 'invalid')

      const userInfo = await User.find(userId)
      const cheaterName = userInfo?.name || 'Jugador desconocido'

      // Agregar a la lista de baneados
      const bannedPlayers = game.bannedPlayers || []
      if (!bannedPlayers.includes(cheaterName)) {
        bannedPlayers.push(cheaterName)
      }

      await this.playerGameModel.update_by_id(player._id.toString(), {
        isSpectator: true,
        result: 'lose',
        claimedWin: false,
      })

      // Continuar el juego actualizando la lista de baneados
      await this.gameModel.update_by_id(gameId, {
        status: 'in_progress',
        bannedPlayers,
      })

      return false
    }
  }

  // ========================================
  // MÉTODOS ADICIONALES
  // ========================================

  async kickPlayer(gameId: string, hostUserId: number, kickUserId: number) {
    const game = await this.gameModel.find_by_id(gameId)
    if (!game) throw new Error('Juego no encontrado')

    if (game.status !== 'waiting' && game.status !== 'card_selection') {
      throw new Error('Solo se puede expulsar jugadores en el lobby')
    }

    const host = await this.playerGameModel.find_one({
      userId: hostUserId,
      gameId: game._id,
      isHost: true,
    })
    if (!host) throw new Error('Solo el anfitrión puede expulsar jugadores')

    const playerToKick = await this.playerGameModel.find_one({
      userId: kickUserId,
      gameId: game._id,
      isHost: false,
    })
    if (!playerToKick) throw new Error('Jugador no encontrado o no se puede expulsar')

    game.players = game.players.filter((id) => id.toString() !== playerToKick._id.toString())
    await this.gameModel.update_by_id(gameId, { players: game.players })

    await this.playerGameModel.delete_by_id(playerToKick._id.toString())

    if (game.players.length === 0) {
      await this.gameModel.update_by_id(gameId, { status: 'waiting' })
    }

    const kickedUser = await User.find(kickUserId)

    return {
      kicked: true,
      kickedUserId: kickUserId,
      message: `Jugador ${kickedUser?.name || kickUserId} expulsado de la partida`,
    }
  }

  async processCurrentCard(gameId: string) {
    await this.gameModel.update_by_id(gameId, { currentCard: undefined })

    return {
      message: 'Carta procesada, se puede sacar la siguiente',
    }
  }
}
