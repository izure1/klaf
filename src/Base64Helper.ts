export class Base64Helper {
  static readonly UrlSafeDomain = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=-_'.split('')

  static UrlSafeEncode(plain: string): string {
    return btoa(plain).replaceAll('+', '-').replaceAll('/', '_')
  }

  static UrlSafeDecode(base64: string): string {
    return atob(base64.replaceAll('-', '+').replaceAll('_', '/'))
  }
}
