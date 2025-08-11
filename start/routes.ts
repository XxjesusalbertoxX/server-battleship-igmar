import AuthController from '#controllers/auth_controller'
import PeopleController from '#controllers/people_controller'
import router from '@adonisjs/core/services/router'
import AuthJwt from '#middleware/auth_jwt_middleware'
import LogsController from '#controllers/logs_controller'
import UserModel from '#models/user'
const GameController = () => import('#controllers/games_controller')
const SimonsaysController = () => import('#controllers/simonsays_controller')
const BattleshipsController = () => import('#controllers/battleships_controller')
const StatsController = () => import('#controllers/stats_controller')
const LoteriaController = () => import('#controllers/loteria_controller')

router.post('/register', (ctx) => new AuthController().register(ctx))
router.post('/login', (ctx) => new AuthController().login(ctx))
router.get('/auth/verify', (ctx) => new AuthController().verify(ctx))
router.post('/auth/refresh', (ctx) => new AuthController().refresh(ctx))

router.get('/check-email/:email', async ({ params, response }) => {
  const user = await UserModel.findByEmail(params.email)
  return response.ok({ exists: !!user })
})

router
  .group(() => {
    router.get('/auth/user', (ctx) => new AuthController().getUser(ctx))
    router.get('/people', (ctx) => new PeopleController().index(ctx))
    router.post('/people', (ctx) => new PeopleController().store(ctx))
    router.get('/people/statistics', (ctx) => new PeopleController().statistics(ctx))
    router.get('/people/:id', (ctx) => new PeopleController().show(ctx))
    router.put('/people/:id', (ctx) => new PeopleController().update(ctx))
  router.patch('/people/:id/deactivate', (ctx) => new PeopleController().deactivate(ctx))

    // Rutas de logs
    router.get('/logs', (ctx) => new LogsController().index(ctx))
    router.get('/logs/user/:userId', (ctx) => new LogsController().getByUser(ctx))
    router.get('/logs/table/:table', (ctx) => new LogsController().getByTable(ctx))
  })
  .middleware([
    async (ctx, next) => {
      const mw = new AuthJwt()
      await mw.handle(ctx, next)
    },
  ])

// router
//   .group(() => {
//     router.post(':gameType/create', [GameController, 'createGame'])
//     router.post('/join', [GameController, 'joinGame'])
//     router.get('/:id', [GameController, 'showGame'])
//     router.post('/:id/ready', [GameController, 'setReady'])
//     router.get('/:id/lobby-status', [GameController, 'lobbyStatus'])
//     router.get('/:id/status', [GameController, 'gameStatus'])
//   })
//   .prefix('/game')
//   .middleware([
//     async (ctx, next) => {
//       const mw = new AuthJwt()
//       await mw.handle(ctx, next)
//     },
//   ])

// router
//   .group(() => {
//     router.post('/:id/start', [BattleshipsController, 'startGame'])
//     router.post('/:id/attack/:x/:y', [BattleshipsController, 'attack'])
//     router.post('/:id/surrender', [BattleshipsController, 'surrender'])
//     router.post('/:id/heartbeat', [BattleshipsController, 'heartbeat'])
//   })
//   .prefix('/battleship')
//   .middleware([
//     async (ctx, next) => {
//       const mw = new AuthJwt()
//       await mw.handle(ctx, next)
//     },
//   ])

router
  .group(() => {
    router.post('/:id/start', [GameController, 'start'])
    router.post(':gameType/create', [GameController, 'createGame'])
    router.post('/join', [GameController, 'joinGame'])
    router.post('/:id/ready', [GameController, 'setReady'])
    router.get('/:id/lobby-status', [GameController, 'lobbyStatus'])
    router.get('/:id/status', [GameController, 'gameStatus'])
    router.post('/:id/leave', [GameController, 'leaveGame'])
    router.patch('/:id/heartbeat', [GameController, 'heartbeat'])
  })
  .prefix('/game')
  .middleware(async (ctx, next) => {
    await new AuthJwt().handle(ctx, next)
  })

// Rutas específicas de Battleship en /battleship
router
  .group(() => {
    router.post('/:id/attack/:x/:y', [BattleshipsController, 'attack'])
  })
  .prefix('/battleship')
  .middleware(async (ctx, next) => {
    await new AuthJwt().handle(ctx, next)
  })

router
  .group(() => {
    router.get('/games', [StatsController, 'getBattleshipStats'])
    router.get('/game/:id', [StatsController, 'getGameDetails'])
  })
  .prefix('/battleship/stats')
  .middleware(async (ctx, next) => {
    await new AuthJwt().handle(ctx, next)
  })

// Rutas específicas de Simon Says en /simonsay
router
  .group(() => {
    router.post('/:id/choose-first-color', [SimonsaysController, 'chooseColor']) // AGREGAR ESTA LÍNEA
    router.post('/:id/play-color', [SimonsaysController, 'repeatColor']) // NUEVO
    router.post('/:id/choose-color', [SimonsaysController, 'chooseColor'])
  })
  .prefix('/simonsay')
  .middleware(async (ctx, next) => {
    await new AuthJwt().handle(ctx, next)
  })

router
  .group(() => {
    router.post('/:id/generate-card', [LoteriaController, 'generateCard'])
    router.post('/:id/draw-card', [LoteriaController, 'drawCard'])
    router.post('/:id/reshuffle', [LoteriaController, 'reshuffleCards'])
    router.post('/:id/place-token', [LoteriaController, 'placeToken'])
    router.post('/:id/claim-win', [LoteriaController, 'claimWin'])
    router.post('/:id/kick-player', [LoteriaController, 'kickPlayer'])
  })
  .prefix('/loteria')
  .middleware(async (ctx, next) => {
    await new AuthJwt().handle(ctx, next)
  })
