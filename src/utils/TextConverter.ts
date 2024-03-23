import { CacheBranchSync } from 'cachebranch'

export class TextConverter {
  protected static readonly Encoder = new TextEncoder()
  protected static readonly Decoder = new TextDecoder()
  private static readonly _CachedText = new CacheBranchSync<string>() 
  private static readonly _CachedRaw = new CacheBranchSync<number[]>() 

  static FromArray(array: number[]): string {
    return TextConverter._CachedText.ensure(array.join(','), () => (
      TextConverter.Decoder.decode(Uint8Array.from(array))
    )).raw
  }

  static ToArray(str: string): number[] {
    return TextConverter._CachedRaw.ensure(str, () => (
      Array.from(TextConverter.Encoder.encode(str))
    )).clone() as number[]
  }
}
