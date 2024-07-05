import { fstatSync, readSync, writeSync } from 'node:fs'

import { IterableView } from './IterableView'

export abstract class DataEngine {
  abstract size(): number
  abstract read(start: number, length: number): number[]
  abstract update(start: number, data: number[]): number[]
  abstract append(data: number[]): void
}

export class FileEngine extends DataEngine {
  readonly fd: number

  constructor(fd: number) {
    super()
    this.fd = fd
  }

  size(): number {
    return fstatSync(this.fd).size
  }

  read(start: number, length = this.size()-start): number[] {
    const buf = Buffer.alloc(length)
    readSync(this.fd, buf, 0, buf.length, start)
    return Array.from(buf)
  }

  update(start: number, data: number[]): number[] {
    const size      = this.size()
    const writable  = Math.min(data.length, size-start)
    const chunk     = data.slice(0, writable)
    const buf       = Uint8Array.from(chunk)

    writeSync(this.fd, buf, 0, buf.length, start)
    return chunk
  }

  append(data: number[]): void {
    const buf = Uint8Array.from(data)
    const pos = fstatSync(this.fd).size
    writeSync(this.fd, buf, 0, buf.length, pos)
  }
}

export class InMemoryEngine extends DataEngine {
  readonly data: number[]

  constructor() {
    super()
    this.data = []
  }

  size(): number {
    return this.data.length
  }

  read(start: number, length = this.size()-start): number[] {
    return IterableView.Read(this.data, start, length)
  }

  update(start: number, data: number[]): number[] {
    const size      = this.size()
    const writable  = Math.min(data.length, size-start)
    const chunk     = data.slice(0, writable)
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
