import { Document, Model, UpdateQuery } from 'mongoose'

export class BaseModel<TDocument extends Document, CreateInput, UpdateInput = Partial<TDocument>> {
  protected model: Model<TDocument>

  constructor(model: Model<TDocument>) {
    this.model = model
  }

  async create(data: CreateInput) {
    return this.model.create(data)
  }

  async update_by_id(id: string, data: UpdateInput) {
    return this.model.findByIdAndUpdate(id, data as UpdateQuery<TDocument>, { new: true })
  }

  async find_by_id(id: string) {
    return this.model.findById(id)
  }

  async find_one(filter: any) {
    return this.model.findOne(filter)
  }

  async find_all(filter: any = {}) {
    return this.model.find(filter)
  }

  async delete_by_id(id: string) {
    return this.model.findByIdAndDelete(id)
  }

  async paginate(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.model.find().skip(skip).limit(limit),
      this.model.countDocuments(),
    ])
    return { data, total, page, pages: Math.ceil(total / limit) }
  }

  get_model() {
    return this.model
  }
}
