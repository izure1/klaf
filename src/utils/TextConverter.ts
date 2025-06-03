export class TextConverter {
  protected static readonly Encoder = new TextEncoder()
  protected static readonly Decoder = new TextDecoder()

  static FromArray(array: Uint8Array): string {
    return TextConverter.Decoder.decode(array)
  }

  static ToArray(str: string): Uint8Array {
    return TextConverter.Encoder.encode(str)
  }
}
