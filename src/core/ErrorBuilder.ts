export class ErrorBuilder {
  static ERR_DB_ALREADY_EXISTS(file: string) {
    return new Error(`The path '${file}' database file is already existing. If you want overwrite, pass a 'overwrite' parameter with 'true'.`)
  }
  
  static ERR_DB_INVALID(file: string) {
    return new Error(`The path '${file}' database file seems to be invalid. Maybe broken or incorrect format.`)
  }

  static ERR_DB_NO_EXISTS(file: string) {
    return new Error(`The database file not exists in '${file}'.`)
  }

  static ERR_ALREADY_DELETED(recordId: string) {
    return new Error(`The record '${recordId}' is already deleted.`)
  }

  static ERR_INVALID_RECORD(recordId: string) {
    return new Error(`The record '${recordId}' is invalid. Maybe incorrect id.`)
  }

  static ERR_UNSUPPORTED_ENGINE() {
    return new Error(`This feature is not supported by the current database engine.`)
  }

  static ERR_DATABASE_CLOSING() {
    return new Error('The record cannot be changed because the database is closing.')
  }
}
