import { FpeCipher } from 'node-fpe';
export declare class FpeBuilder {
    private _secret;
    private _domain;
    constructor();
    setSecretKey(secret: string): this;
    setDomain(domain: string[]): this;
    build(): FpeCipher;
}
