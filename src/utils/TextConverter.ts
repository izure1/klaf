import { CacheStore } from '../utils/CacheStore'

export class TextConverter {
  protected static readonly Encoder = new TextEncoder()
  protected static readonly Decoder = new TextDecoder()
  private static readonly _CachedText = new CacheStore<string>() 
  private static readonly _CachedRaw = new CacheStore<number[]>() 

  static FromArray(array: number[]): string {
    return TextConverter._CachedText.ensure(array.join(','), () => (
      TextConverter.Decoder.decode(Uint8Array.from(array))
    ))
  }

  static ToArray(str: string): number[] {
    const numerics = [] as number[]
    return numerics.concat(
      TextConverter._CachedRaw.ensure(
        str,
        () => Array.from(TextConverter.Encoder.encode(str))
      )
    )
  }
}
