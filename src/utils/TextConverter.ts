export class TextConverter {
  protected static readonly Encoder = new TextEncoder()
  protected static readonly Decoder = new TextDecoder()
  private static readonly _CachedText = new Map<string, string>()
  private static readonly _CachedRaw = new Map<string, number[]>()

  static FromArray(array: number[]): string {
    const key = array.join(',')
    if (!TextConverter._CachedText.has(key)) {
      const data = TextConverter.Decoder.decode(Uint8Array.from(array))
      TextConverter._CachedText.set(key, data)
    }
    return TextConverter._CachedText.get(key)!
  }

  static ToArray(str: string): number[] {
    if (!TextConverter._CachedRaw.has(str)) {
      const data = Array.from(TextConverter.Encoder.encode(str))
      TextConverter._CachedRaw.set(str, data)
    }
    const data = TextConverter._CachedRaw.get(str)!
    const clone = data.slice()
    return clone
  }
}
