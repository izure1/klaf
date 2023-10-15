export declare class TextConverter {
    protected static Encoder: TextEncoder;
    protected static Decoder: TextDecoder;
    static FromArray(array: Iterable<number>): string;
    static ToArray(str: string): number[];
}
