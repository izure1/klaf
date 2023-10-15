declare module 'node-fpe' {
  interface FpeCipher {
    encrypt(str: string): string
    decrypt(str: string): string
  }
  type FpeConstructorParams = {
    secret: string
    domain?: string[]
  }
  function FpeConstructor(params: FpeConstructorParams): FpsCipher
  const fpe: typeof FpeConstructor
  export default fpe
  export { FpeCipher }
}
