export class IntegerConverter {
  protected static Buffer8  = new ArrayBuffer(1)
  protected static Buffer16 = new ArrayBuffer(2)
  protected static Buffer32 = new ArrayBuffer(4)
  protected static Buffer64 = new ArrayBuffer(8)
  protected static View8    = new DataView(IntegerConverter.Buffer8)
  protected static View16   = new DataView(IntegerConverter.Buffer16)
  protected static View32   = new DataView(IntegerConverter.Buffer32)
  protected static View64   = new DataView(IntegerConverter.Buffer64)


  static FromArray8(array: number[]): number {
    const view = IntegerConverter.View8
    for (let i = 0; i < array.length; i++) {
      view.setUint8(i, array[i])
    }
    return view.getUint8(0)
  }

  static FromArray16(array: number[]): number {
    const view = IntegerConverter.View16
    for (let i = 0; i < array.length; i++) {
      view.setUint8(i, array[i])
    }
    return view.getUint16(0)
  }

  static FromArray32(array: number[]): number {
    const view = IntegerConverter.View32
    for (let i = 0; i < array.length; i++) {
      view.setUint8(i, array[i])
    }
    return view.getUint32(0)
  }

  static FromArray64(array: number[]): number {
    const view = IntegerConverter.View64
    for (let i = 0; i < array.length; i++) {
      view.setUint8(i, array[i])
    }
    return Number(view.getBigUint64(0))
  }

  static ToArray8(num: number): number[] {
    const view = IntegerConverter.View8
    view.setUint8(0, num)
    const array = []
    for (let i = 0; i < 1; i++) {
      array.push(view.getUint8(i))
    }
    return array
  }

  static ToArray16(num: number): number[] {
    const view = IntegerConverter.View16
    view.setUint16(0, num)
    const array = []
    for (let i = 0; i < 2; i++) {
      array.push(view.getUint8(i))
    }
    return array
  }

  static ToArray32(num: number): number[] {
    const view = IntegerConverter.View32
    view.setUint32(0, num)
    const array = []
    for (let i = 0; i < 4; i++) {
      array.push(view.getUint8(i))
    }
    return array
  }

  static ToArray64(num: number): number[] {
    const view = IntegerConverter.View64
    view.setBigUint64(0, BigInt(num))
    const array = []
    for (let i = 0; i < 8; i++) {
      array.push(view.getUint8(i))
    }
    return array
  }
}
