import { CacheBranchSync } from 'cachebranch'
import { h64 } from 'xxhashjs'

export class TextConverter {
  protected static readonly Encoder = new TextEncoder()
  protected static readonly Decoder = new TextDecoder()
  private static readonly _CachedText = new CacheBranchSync<{
    [key: string]: string|number[]
  }>()
  private static readonly _CachedRaw = new CacheBranchSync<{
    [key: string]: number[]
  }>()

  static FromArray(array: number[]): string {
    return TextConverter._CachedText.ensure(array.join(','), () => (
      TextConverter.Decoder.decode(Uint8Array.from(array))
    )).raw as string
  }

  static ToArray(str: string): number[] {
    const hashKey = h64(str, 0).toString(16) as string
    return TextConverter._CachedRaw.ensure(hashKey, () => (
      Array.from(TextConverter.Encoder.encode(str))
    )).clone() as number[]
  }
}
