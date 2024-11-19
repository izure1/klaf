import { ErrorBuilder as CoreErrorBuilder } from '../core/ErrorBuilder'

export class ErrorBuilder extends CoreErrorBuilder {
  static ERR_INVALID_OBJECT(stringify: string) {
    return new Error(`The '${stringify}' string can't be parsed.`)
  }

  static ERR_DATABASE_CLOSING() {
    return new Error('The record cannot be changed because the database is closing.')
  }
}
