export class TextConverter {
  protected static readonly Encoder = new TextEncoder()
  protected static readonly Decoder = new TextDecoder()

  static FromArray(array: number[]): string {
    return TextConverter.Decoder.decode(Uint8Array.from(array))
  }

  static ToArray(str: string): number[] {
    return Array.from(TextConverter.Encoder.encode(str))
  }
}
