import fs from 'fs'

export class IterableView {
  static Read<T>(array: T[], start: number, length = array.length-start): T[] {
    return array.slice(start, start+length)
  }

  static Update<T>(array: T[], start: number, data: T[]): T[] {
    for (let i = 0, len = Math.min(data.length, array.length-start); i < len; i++) {
      const j = start+i
      array[j] = data[i]
    }
    return array
  }

  static Ensure<T>(array: T[], len: number, fill: T): T[] {
    if (array.length >= len) {
      return array
    }
    const extended = new Array(len-array.length).fill(fill)
    array.push(...extended)
    return array
  }
}

export class FileView {
  static Size(fd: number): number {
    return fs.fstatSync(fd).size
  }

  static Read(fd: number, start: number, length = FileView.Size(fd)-start): number[] {
    const buf = Buffer.alloc(length)
    fs.readSync(fd, buf, 0, buf.length, start)
    return Array.from(buf)
  }

  static Update(fd: number, start: number, data: number[]): number[] {
    const size      = FileView.Size(fd)
    const writable  = Math.min(data.length, size-start)
    const chunk     = data.slice(0, writable)
    const buf       = Uint8Array.from(chunk)

    fs.writeSync(fd, buf, 0, buf.length, start)
    return chunk
  }

  static Append(fd: number, data: number[]): void {
    const buf = Uint8Array.from(data)
    const pos = fs.fstatSync(fd).size
    fs.writeSync(fd, buf, 0, buf.length, pos)
  }
}
