export class IntegerConverter {
  protected static Buffer8    = new ArrayBuffer(1)
  protected static Buffer16   = new ArrayBuffer(2)
  protected static Buffer32   = new ArrayBuffer(4)
  protected static Buffer64   = new ArrayBuffer(8)
  protected static Buffer128  = new ArrayBuffer(16)
  protected static Buffer256  = new ArrayBuffer(32)
  protected static View8      = new DataView(IntegerConverter.Buffer8)
  protected static View16     = new DataView(IntegerConverter.Buffer16)
  protected static View32     = new DataView(IntegerConverter.Buffer32)
  protected static View64     = new DataView(IntegerConverter.Buffer64)
  protected static View128    = new DataView(IntegerConverter.Buffer128)
  protected static View256    = new DataView(IntegerConverter.Buffer256)


  static FromArray8(array: Uint8Array): number {
    const view = IntegerConverter.View8
    for (let i = 0; i < 1; i++) {
      view.setUint8(i, array[i])
    }
    return view.getUint8(0)
  }

  static FromArray16(array: Uint8Array): number {
    const view = IntegerConverter.View16
    for (let i = 0; i < 2; i++) {
      view.setUint8(i, array[i])
    }
    return view.getUint16(0)
  }

  static FromArray32(array: Uint8Array): number {
    const view = IntegerConverter.View32
    for (let i = 0; i < 4; i++) {
      view.setUint8(i, array[i])
    }
    return view.getUint32(0)
  }

  static FromArray64(array: Uint8Array): bigint {
    const view = IntegerConverter.View64
    for (let i = 0; i < 8; i++) {
      view.setUint8(i, array[i])
    }
    return view.getBigUint64(0)
  }

  static FromArray128(array: Uint8Array): bigint {
    let hex = ''
    for(let i = 0; i < 16; i++) {
      hex += array[i].toString(16).padStart(2, '0')
    }
    return BigInt('0x' + hex)
  }

  static FromArray256(array: Uint8Array): bigint {
    let hex = ''
    for(let i = 0; i < 32; i++) {
      hex += array[i].toString(16).padStart(2, '0')
    }
    return BigInt('0x' + hex)
  }

  static FromAuto(array: Uint8Array, size: number): number|bigint {
    switch (size) {
      case 1:   return IntegerConverter.FromArray8(array)
      case 2:   return IntegerConverter.FromArray16(array)
      case 4:   return IntegerConverter.FromArray32(array)
      case 8:   return IntegerConverter.FromArray64(array)
      case 16:  return IntegerConverter.FromArray128(array)
      case 32:  return IntegerConverter.FromArray256(array)
      default:  throw new Error(`Invalid size: ${size}`)
    }
  }

  static ToArray8(num: number): Uint8Array {
    const view = IntegerConverter.View8
    view.setUint8(0, num)
    const array = new Uint8Array(1)
    for (let i = 0; i < 1; i++) {
      array[i] = view.getUint8(i)
    }
    return array
  }

  static ToArray16(num: number): Uint8Array {
    const view = IntegerConverter.View16
    view.setUint16(0, num)
    const array = new Uint8Array(2)
    for (let i = 0; i < 2; i++) {
      array[i] = view.getUint8(i)
    }
    return array
  }

  static ToArray32(num: number): Uint8Array {
    const view = IntegerConverter.View32
    view.setUint32(0, num)
    const array = new Uint8Array(4)
    for (let i = 0; i < 4; i++) {
      array[i] = view.getUint8(i)
    }
    return array
  }

  static ToArray64(num: bigint): Uint8Array {
    const view = IntegerConverter.View64
    view.setBigUint64(0, num)
    const array = new Uint8Array(8)
    for (let i = 0; i < 8; i++) {
      array[i] = view.getUint8(i)
    }
    return array
  }

  static ToArray128(num: bigint): Uint8Array {
    const len = 16
    const hex = num.toString(16).padStart(len, '0')
    const array = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      const j = i*2
      array[i] = parseInt(hex.substring(j, j+2), 16)
    }
    return array
  }

  static ToArray256(num: bigint): Uint8Array {
    const len = 32
    const hex = num.toString(16).padStart(len, '0')
    const array = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      const j = i*2
      array[i] = parseInt(hex.substring(j, j+2), 16)
    }
    return array
  }

  static ToAuto(num: number|bigint, size: number): Uint8Array {
    if (typeof num === 'number') {
      switch (size) {
        case 1:   return IntegerConverter.ToArray8(num)
        case 2:   return IntegerConverter.ToArray16(num)
        case 4:   return IntegerConverter.ToArray32(num)
        default:  throw new Error(`Invalid size: ${size}`)
      }
    }
    else {
      switch (size) {
        case 8:   return IntegerConverter.ToArray64(num)
        case 16:  return IntegerConverter.ToArray128(num)
        case 32:  return IntegerConverter.ToArray256(num)
        default:  throw new Error(`Invalid size: ${size}`)
      }
    }
  }
}
