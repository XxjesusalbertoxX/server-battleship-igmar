import { Schema, model, Document } from 'mongoose'

export interface LogDocument extends Document {
  user_id: number // ID del usuario desde PostgreSQL
  action: string // Acción que se ejecutó
  table: string // A qué tabla afecta (por ejemplo: "people")
  description?: string // Opcional, más contexto
  metadata?: any // Info adicional: puede incluir el ID afectado, cambios, etc
  timestamp: Date // Cuándo ocurrió
}

const LogSchema = new Schema<LogDocument>({
  user_id: { type: Number, required: true },
  action: { type: String, required: true },
  table: { type: String, required: true },
  description: { type: String },
  metadata: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
})

export const LogModel = model<LogDocument>('Log', LogSchema)
