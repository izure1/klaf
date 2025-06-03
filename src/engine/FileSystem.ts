import type { OpenMode, Stats } from 'node:fs'
import { Buffer } from 'node:buffer'
import { dirname } from 'node:path'
import { fstat, ftruncate, read, write, existsSync, open, close } from 'node:fs'
import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { DataEngine } from './DataEngine'

export class FileSystemEngine extends DataEngine {
  protected static Open(file: string, mode: OpenMode): Promise<number> {
    return new Promise((resolve, reject) => {
      open(file, mode, (err, fd) => {
        if (err) {
          return reject(err)
        }
        resolve(fd)
      })
    })
  }

  protected static Read(
    fd: number,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      read(fd, buffer, offset, length, position, (err, bytesRead) => {
        if (err) {
          return reject(err)
        }
        resolve(bytesRead)
      })
    })
  }

  protected static Write(
    fd: number,
    buffer: NodeJS.ArrayBufferView,
    offset: number,
    length: number,
    position: number
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      write(fd, buffer, offset, length, position, (err, written) => {
        if (err) {
          return reject(err)
        }
        resolve(written)
      })
    })
  }

  protected static Truncate(fd: number, size: number): Promise<void> {
    return new Promise((resolve, reject) => {
      ftruncate(fd, size, (err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }

  protected static Close(fd: number): Promise<void> {
    return new Promise((resolve) => {
      return close(fd, resolve as () => void)
    })
  }

  protected static FStats(fd: number): Promise<Stats> {
    return new Promise((resolve, reject) => {
      fstat(fd, (err, stats) => {
        if (err) {
          return reject(err)
        }
        resolve(stats)
      })
    })
  }

  protected fd!: number
  private readonly _buffers: Map<number, Buffer>

  constructor() {
    super()
    this._buffers = new Map()
  }

  private _getBuffer(size: number): Buffer {
    if (!this._buffers.has(size)) {
      this._buffers.set(size, Buffer.alloc(size))
    }
    return this._buffers.get(size)!
  }

  get clone(): FileSystemEngine {
    return new FileSystemEngine()
  }

  async exists(file: string): Promise<boolean> {
    return existsSync(file)
  }

  async boot(file: string): Promise<void> {
  }

  async create(file: string, initialData: Uint8Array): Promise<void> {
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, initialData)
  }
  
  async open(file: string): Promise<void> {
    this.fd = await FileSystemEngine.Open(file, 'r+')
  }

  async close(): Promise<void> {
    if (this.fd === undefined) {
      return
    }
    await FileSystemEngine.Close(this.fd)
    this.fd = undefined as any
  }

  async size(): Promise<number> {
    const stats = await FileSystemEngine.FStats(this.fd)
    return stats.size
  }

  async read(start: number, length?: number): Promise<Uint8Array> {
    if (length === undefined) {
      const size = await this.size()
      length = size - start
      if (length > size) length = size
    }
    if (length === 0) return new Uint8Array()
    
    const buf = this._getBuffer(length)
    await FileSystemEngine.Read(this.fd, buf, 0, buf.length, start)
    return Uint8Array.from(buf)
  }

  async update(start: number, data: Uint8Array): Promise<Uint8Array> {
    const size      = await this.size()
    const length    = Math.min(data.length, size - start)
    const buf       = data.subarray(0, length)

    await FileSystemEngine.Write(this.fd, buf, 0, buf.length, start)
    return buf
  }

  async append(data: Uint8Array): Promise<void> {
    const pos = await this.size()
    await FileSystemEngine.Write(this.fd, data, 0, data.length, pos)
  }

  async truncate(size: number): Promise<void> {
    await FileSystemEngine.Truncate(this.fd, size)
  }

  async unlink(file: string): Promise<void> {
    await unlink(file)
  }

  async reset(file: string): Promise<void> {
    this.fd = undefined as any
  }
}
