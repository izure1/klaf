/// <reference types="node" />
export declare class CryptoHelper {
    static RandomBytes(size: number): Uint8Array;
    static EncryptAES256(text: string, secret: Buffer): string;
    static DecryptAES256(text: string, secret: Buffer): string;
}
