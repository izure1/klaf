import { CacheBranchSync } from 'cachebranch'

export class Base64Helper {
  static readonly UrlDomain = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=+/'.split('')
  static readonly UrlSafeDomain = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=-_'.split('')
  private static readonly _CachedEncodedUrl = new CacheBranchSync<string>()
  private static readonly _CachedDecodedUrl = new CacheBranchSync<string>()

  static UrlSafeEncode(plain: string): string {
    return Base64Helper._CachedEncodedUrl.ensure(plain, () => (
      btoa(plain).replaceAll('+', '-').replaceAll('/', '_')
    )).raw
  }

  static UrlSafeDecode(base64: string): string {
    return Base64Helper._CachedDecodedUrl.ensure(base64, () => (
      atob(base64.replaceAll('-', '+').replaceAll('_', '/'))
    )).raw
  }
}
