import AuthController from '#controllers/auth_controller'
import PeopleController from '#controllers/people_controller'
const GameController = () => import('#controllers/games_controller')
import router from '@adonisjs/core/services/router'
import AuthJwt from '#middleware/auth_jwt_middleware'
import UserModel from '#models/user'
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

router
  .group(() => {
    router.post('/create', [GameController, 'createGame'])
    router.post('/join', [GameController, 'joinGame'])
    router.get('/:id', [GameController, 'showGame'])
    router.post('/:id/ready', [GameController, 'setReady'])
    router.get('/:id/lobby-status', [GameController, 'lobbyStatus'])
    router.get('/:id/status', [GameController, 'gameStatus'])
  })
  .prefix('/game')
  .middleware([
    async (ctx, next) => {
      const mw = new AuthJwt()
      await mw.handle(ctx, next)
    },
  ])

router
  .group(() => {
    router.post('/:id/start', [BattleshipsController, 'startGame'])
    router.post('/:id/attack/:x/:y', [BattleshipsController, 'attack'])
    router.post('/:id/surrender', [BattleshipsController, 'surrender'])
    router.post('/:id/heartbeat', [BattleshipsController, 'heartbeat'])
  })
  .prefix('/battleship')
  .middleware([
    async (ctx, next) => {
      const mw = new AuthJwt()
      await mw.handle(ctx, next)
    },
  ])
