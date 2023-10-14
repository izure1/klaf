export declare class IntegerConverter {
    protected static Buffer8: ArrayBuffer;
    protected static Buffer16: ArrayBuffer;
    protected static Buffer32: ArrayBuffer;
    protected static Buffer64: ArrayBuffer;
    protected static View8: DataView;
    protected static View16: DataView;
    protected static View32: DataView;
    protected static View64: DataView;
    static FromArray8(array: number[]): number;
    static FromArray16(array: number[]): number;
    static FromArray32(array: number[]): number;
    static FromArray64(array: number[]): number;
    static ToArray8(num: number): number[];
    static ToArray16(num: number): number[];
    static ToArray32(num: number): number[];
    static ToArray64(num: number): number[];
}
