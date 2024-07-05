export class IterableView {
  static Copy<T>(array: T[]): T[] {
    return array.slice()
  }

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
  
  read<T>(array: T[], start: number, length = array.length-start): T[] {
    return IterableView.Read(array, start, length)
  }
  
  update<T>(array: T[], start: number, data: T[]): T[] {
    return IterableView.Update(array, start, data)
  }

  ensure<T>(array: T[], len: number, fill: T): T[] {
    return IterableView.Ensure(array, length, fill)
  }
}
