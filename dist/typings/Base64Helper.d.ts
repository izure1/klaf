export declare class Base64Helper {
    static readonly UrlDomain: string[];
    static readonly UrlSafeDomain: string[];
    static UrlSafeEncode(plain: string): string;
    static UrlSafeDecode(base64: string): string;
}
