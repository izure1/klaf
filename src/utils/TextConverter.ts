import { CacheEntanglementSync } from 'cache-entanglement'

export class TextConverter {
  protected static readonly Encoder = new TextEncoder()
  protected static readonly Decoder = new TextDecoder()
  private static readonly _CachedText = new CacheEntanglementSync((key, state, array: number[]) => {
    return TextConverter.Decoder.decode(Uint8Array.from(array))
  })
  private static readonly _CachedRaw = new CacheEntanglementSync((key, state) => {
    return Array.from(TextConverter.Encoder.encode(key))
  })

  static FromArray(array: number[]): string {
    return TextConverter._CachedText.cache(array.join(','), array).raw
  }

  static ToArray(str: string): number[] {
    return TextConverter._CachedRaw.cache(str).clone('array-shallow-copy')
  }
}
