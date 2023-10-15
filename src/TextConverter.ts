export class TextConverter {
  protected static Encoder = new TextEncoder()
  protected static Decoder = new TextDecoder()

  static FromArray(array: Iterable<number>): string {
    const r = Uint8Array.from(array)
    return TextConverter.Decoder.decode(r)
  }

  static ToArray(str: string): number[] {
    return Array.from(TextConverter.Encoder.encode(str))
  }
}
