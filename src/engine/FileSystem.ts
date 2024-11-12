import { dirname } from 'node:path'
import { fstatSync, readSync, writeSync, writeFileSync, existsSync, mkdirSync, openSync, closeSync } from 'node:fs'
import { DataEngine } from './DataEngine'

export class FileSystemEngine extends DataEngine {
  protected fd!: number

  async exists(file: string): Promise<boolean> {
    return existsSync(file)
  }

  async boot(file: string): Promise<void> {
  }

  async create(file: string, initialData: number[]): Promise<void> {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, Buffer.from(initialData))
  }

  async open(file: string): Promise<void> {
    this.fd = openSync(file, 'r+')
  }

  async close(): Promise<void> {
    if (this.fd === undefined) {
      return
    }
    closeSync(this.fd)
  }

  size(): number {
    return fstatSync(this.fd).size
  }

  read(start: number, length: number = this.size()-start): number[] {
    const buf = Buffer.alloc(length)
    readSync(this.fd, buf, 0, buf.length, start)
    return Array.from(buf)
  }

  update(start: number, data: number[]): number[] {
    const size      = this.size()
    const length    = Math.min(data.length, size-start)
    const chunk     = data.slice(0, length)
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
