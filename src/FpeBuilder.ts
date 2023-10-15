import fpe, { FpeCipher } from 'node-fpe'

export class FpeBuilder {
  private _secret: string
  private _domain: string[]

  static readonly Base64UrlSafeDomain = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=-_'.split('')

  constructor() {
    this._secret = ''
    this._domain = []
  }

  setSecretKey(secret: string): this {
    this._secret = secret
    return this
  }
  
  setDomain(domain: string[]): this {
    this._domain = domain
    return this
  }
  
  build(): FpeCipher {
    return fpe({
      secret: this._secret,
      domain: this._domain
    })
  }
}
