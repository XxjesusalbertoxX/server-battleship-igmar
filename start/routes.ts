import AuthController from '#controllers/auth_controller'
import PeopleController from '#controllers/people_controller'
import router from '@adonisjs/core/services/router'
import AuthJwt from '#middleware/auth_jwt_middleware'
import UserModel from '#models/user'
const GameController = () => import('#controllers/games_controller')
const StatsController = () => import('#controllers/stats_controller')
const SimonsaysController = () => import('#controllers/simonsays_controller')
const BattleshipsController = () => import('#controllers/battleships_controller')

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
    router.patch('/people/:id/deactivate', (ctx) => new PeopleController().softDelete(ctx))
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
    router.post('/:id/rematch', [GameController, 'requestRematch'])
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
    router.post('/:id/surrender', [BattleshipsController, 'surrender']) // Añadir esta línea
  })
  .prefix('/battleship')
  .middleware(async (ctx, next) => {
    await new AuthJwt().handle(ctx, next)
  })

// Rutas específicas de Simon Says en /simonsay
router
  .group(() => {
    router.post('/:id/colors', [SimonsaysController, 'setColors'])
    router.post('/:id/choose-first-color', [SimonsaysController, 'chooseFirstColor']) // NUEVO
    router.post('/:id/play-color', [SimonsaysController, 'playColor']) // NUEVO
    router.post('/:id/choose-color', [SimonsaysController, 'chooseColor'])
    // Eliminar: router.post('/:id/play-sequence', [SimonsaysController, 'playSequence'])
  })
  .prefix('/simonsay')
  .middleware(async (ctx, next) => {
    await new AuthJwt().handle(ctx, next)
  })
