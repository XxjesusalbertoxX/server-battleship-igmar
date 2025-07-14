import mongoose from 'mongoose'

export async function connectToMongo() {
  const mongoUrl = process.env.MONGO_URL

  if (!mongoUrl) {
    console.error('❌ MONGO_URL no está definida en el .env')
    return
  }

  try {
    await mongoose.connect(mongoUrl, {
      // Te aseguras de usar el cliente moderno
      serverSelectionTimeoutMS: 5000, // No espera 10s en errores
    })

    console.log('✅ Conectado a MongoDB')
  } catch (err) {
    console.error('❌ Error al conectar con MongoDB:', err)
  }
}
