export class IterableView {
  static Create<T>(length: number, fill: number): Uint8Array {
    return new Uint8Array(length).fill(fill)
  }

  static Copy<T>(array: Uint8Array): Uint8Array {
    return array.slice()
  }

  static Read(array: Uint8Array, start: number, length = array.length - start): Uint8Array {
    return array.subarray(start, start + length)
  }

  static Update(array: Uint8Array, start: number, data: Uint8Array): Uint8Array {
    const len = Math.min(data.length, array.length - start)
    for (let i = 0; i < len; i++) {
      const j = start + i
      array[j] = data[i]
    }
    return array
  }

  static Fix(array: Uint8Array, len: number, fill: number): Uint8Array {
    if (array.length > len) {
      return array.subarray(0, len)
    }
    else if (array.length === len) {
      return array
    }
    const merged = new Uint8Array(len)
    merged.set(array)
    merged.fill(fill, array.length)
    return merged
  }

  static Concat(a: Uint8Array, b: Uint8Array): Uint8Array {
    const c = new Uint8Array(a.length + b.length)
    c.set(a)
    c.set(b, a.length)
    return c
  }
  
  read(array: Uint8Array, start: number, length = array.length-start): Uint8Array {
    return IterableView.Read(array, start, length)
  }
  
  update(array: Uint8Array, start: number, data: Uint8Array): Uint8Array {
    return IterableView.Update(array, start, data)
  }

  fix(array: Uint8Array, length: number, fill: number): Uint8Array {
    return IterableView.Fix(array, length, fill)
  }

  concat(a: Uint8Array, b: Uint8Array): Uint8Array {
    return IterableView.Concat(a, b)
  }
}
