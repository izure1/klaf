import { DataEngine } from './DataEngine'
import { IterableView } from '../utils/IterableView'

export class InMemoryEngine extends DataEngine {
  protected readonly data: number[]

  constructor() {
    super()
    this.data = []
  }

  async exists(file: string): Promise<boolean> {
    return !!this.data.length
  }

  async boot(file: string): Promise<void> {
  }

  async create(file: string, initialData: number[]): Promise<void> {
    this.data.push(...initialData)
  }

  async open(file: string): Promise<void> {
  }

  async close(): Promise<void> {
    this.data.length = 0
  }

  size(): number {
    return this.data.length
  }

  read(start: number, length = this.size()-start): number[] {
    return IterableView.Read(this.data, start, length)
  }

  update(start: number, data: number[]): number[] {
    const size      = this.size()
    const length    = Math.min(data.length, size-start)
    const chunk     = data.slice(0, length)
    IterableView.Update(this.data, start, chunk)
    return chunk
  }

  append(data: number[]): void {
    this.data.push(...data)
  }

  clear(): void {
    this.data.length = 0
  }
}
