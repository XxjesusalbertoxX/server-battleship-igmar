import User from '#models/user'

export default class UserService {
  // Otorgar experiencia por victoria
  async grantWinExperience(userId: number): Promise<void> {
    const user = await User.find(userId)
    if (!user) throw new Error('Usuario no encontrado')

    user.wins += 1
    user.exp += 250 // 250 EXP por ganar

    await user.save() // El trigger se ejecuta automáticamente
  }

  // Otorgar experiencia por derrota
  async grantLossExperience(userId: number): Promise<void> {
    const user = await User.find(userId)
    if (!user) throw new Error('Usuario no encontrado')

    user.losses += 1
    user.exp += 125 // 125 EXP por perder

    await user.save() // El trigger se ejecuta automáticamente
  }

  // Obtener estadísticas del usuario
  async getUserStats(userId: number) {
    const user = await User.find(userId)
    if (!user) throw new Error('Usuario no encontrado')

    return {
      id: user.id,
      name: user.name,
      wins: user.wins,
      losses: user.losses,
      exp: user.exp,
      level: user.level,
      expToNextLevel: 1000 - user.exp,
    }
  }
}
