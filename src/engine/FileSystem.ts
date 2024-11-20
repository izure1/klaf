import type { OpenMode, Stats } from 'node:fs'
import { Buffer } from 'node:buffer'
import { dirname } from 'node:path'
import { fstat, read, write, existsSync, open, close } from 'node:fs'
import { writeFile, mkdir } from 'node:fs/promises'
import { Ryoiki } from 'ryoiki'
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
  protected readonly locker: Ryoiki

  constructor() {
    super()
    this.locker = new Ryoiki()
  }

  async exists(file: string): Promise<boolean> {
    return existsSync(file)
  }

  async boot(file: string): Promise<void> {
  }

  async create(file: string, initialData: number[]): Promise<void> {
    let lockId: string
    await this.locker.writeLock(async (_lock) => {
      lockId = _lock
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, Buffer.from(initialData))
    }).finally(() => this.locker.writeUnlock(lockId))
  }
  
  async open(file: string): Promise<void> {
    let lockId: string
    await this.locker.readLock(async (_lock) => {
      lockId = _lock
      this.fd = await FileSystemEngine.Open(file, 'r+')
    }).finally(() => this.locker.readUnlock(lockId))
  }

  async close(): Promise<void> {
    if (this.fd === undefined) {
      return
    }
    let lockId: string
    return this.locker.readLock(async (_lock) => {
      lockId = _lock
      return FileSystemEngine.Close(this.fd)
    }).finally(() => this.locker.readUnlock(lockId))
  }

  async size(): Promise<number> {
    let lockId: string
    return this.locker.readLock(async (_lock) => {
      lockId = _lock
      return this._size()
    }).finally(() => this.locker.readUnlock(lockId))
  }

  private async _size(): Promise<number> {
    const stats = await FileSystemEngine.FStats(this.fd)
    return stats.size
  }

  async read(start: number, length?: number): Promise<number[]> {
    let lockId: string
    return this.locker.readLock(async (_lock) => {
      lockId = _lock
      if (length === undefined) {
        length = await this._size()-start
      }
      const buf = Buffer.alloc(length)
      await FileSystemEngine.Read(this.fd, buf, 0, buf.length, start)
      return Array.from(buf)
    }).finally(() => this.locker.readUnlock(lockId))
  }

  async update(start: number, data: number[]): Promise<number[]> {
    let lockId: string
    return this.locker.writeLock(async (_lock) => {
      lockId = _lock
      const size      = await this._size()
      const length    = Math.min(data.length, size-start)
      const chunk     = data.slice(0, length)
      const buf       = Uint8Array.from(chunk)

      await FileSystemEngine.Write(this.fd, buf, 0, buf.length, start)
      return chunk
    }).finally(() => this.locker.writeUnlock(lockId))
  }

  async append(data: number[]): Promise<void> {
    let lockId: string
    return this.locker.writeLock(async (_lock) => {
      lockId = _lock
      const buf = Uint8Array.from(data)
      const pos = await this._size()

      await FileSystemEngine.Write(this.fd, buf, 0, buf.length, pos)
    }).finally(() => this.locker.writeUnlock(lockId))
  }
}
