import { DataEngine } from './DataEngine'
import { IterableView } from '../utils/IterableView'

export class InMemoryEngine extends DataEngine {
  protected data: Uint8Array

  constructor() {
    super()
    this.data = new Uint8Array()
  }

  get clone(): InMemoryEngine {
    return new InMemoryEngine()
  }

  async exists(file: string): Promise<boolean> {
    return !!this.data.length
  }

  async boot(file: string): Promise<void> {
  }

  async create(file: string, initialData: Uint8Array): Promise<void> {
    // this.data.push(...initialData)
    this.data = IterableView.Concat(this.data, initialData)
  }

  async open(file: string): Promise<void> {
  }

  async close(): Promise<void> {
    // this.data.length = 0
    this.data = new Uint8Array()
  }

  async size(): Promise<number> {
    return this.data.length
  }

  async read(start: number, length?: number): Promise<Uint8Array> {
    if (length === undefined) {
      const size = await this.size()
      length = size - start
    }
    return IterableView.Read(this.data, start, length)
  }

  async update(start: number, data: Uint8Array): Promise<Uint8Array> {
    const size      = await this.size()
    const length    = Math.min(data.length, size - start)
    const chunk     = data.subarray(0, length)
    IterableView.Update(this.data, start, chunk)
    return chunk
  }

  async append(data: Uint8Array): Promise<void> {
    this.data = IterableView.Concat(this.data, data)
  }

  async truncate(size: number): Promise<void> {
    if (size > this.data.length) {
      return
    }
    this.data = this.data.subarray(0, size)
  }

  async unlink(file: string): Promise<void> {
    this.clear()
  }

  async reset(file: string): Promise<void> {
    this.data = new Uint8Array()
  }

  clear(): void {
    this.data = new Uint8Array()
  }
}
