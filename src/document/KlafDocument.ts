import { type DataEngine } from '../engine/DataEngine'
import { type DataJournal, AuthenticatedDataJournal } from '../engine/DataJournal'
import {
  type CatchResult,
  Catcher
} from '../utils/Catcher'
import {
  type KlafDocumentable,
  type KlafDocumentScheme,
  KlafDocumentMetadata,
  KlafDocumentOption,
  KlafDocumentQuery,
  KlafDocumentSchemeType,
  KlafDocumentService,
  KlafDocumentShape,
} from './KlafDocumentService'

export interface KlafDocumentConstructorArguments<T extends KlafDocumentable> {
  service: KlafDocumentService<T>
}

export interface KlafDocumentCreateOption<S extends KlafDocumentable, T extends KlafDocumentScheme<S>> {
  /**
   * This is the path where the database file will be created.
   */
  path: string
  /**
   * The engine that determines how the database will function.
   * By default, it supports `FileSystem`, `InMemory`, and `WebWorker`. You can import engine modules from `klaf/engine/~` to use them.
   * If desired, you can extend the DataEngine class to implement your own custom engine.
   */
  engine: DataEngine
  /**
   * This is a feature that prevents data loss that may occur during write operations to the database.
   * If you enable this feature, it will back up the logical pages involved in write operations to a separate file.
   * If the database terminates abnormally and data is lost, it will be automatically recovered using this file.
   * If this option is not set, the journal feature will not be used.
   * 
   * ***IMPORTANT!** The journal instance must use the same class as the engine instance.*
   * @example
   * {
   *  engine: new FileSystemEngine(),
   *  journal: new DataJournal(new FileSystemEngine())
   * }
   */
  journal?: DataJournal
  /**
   * Scheme version.
   */
  version: number
  /**
   * The fields of the database scheme and their validation functions.
   * The property names become field names, and their values perform validation when inserting or updating values.
   * Please refer to the example below.
   * ```
   * const db = KlafDocument.Open({
   *   path: 'my-db-path/database.db',
   *   scheme: {
   *     id: {
   *       default: () => uuid(),
   *       validate: (v) => isUUID(v)
   *     },
   *     email: {
   *       default: () => createDefaultEmail(),
   *       validate: (v) => isEmail(v)
   *     }
   *   }
   * })
   * ```
   * If you use the [validator.js](https://github.com/validatorjs/validator.js) library,
   * you can easily implement these validation checks.
   * Please refer to it for assistance.
   */
  scheme: T
  /**
   * This is the maximum data size a single page in the database can hold. The default is `1024`. If this value is too large or too small, it can affect performance.
   */
  payloadSize?: number
  /**
   * This decides whether to replace an existing database file at the path or create a new one. The default is `false`.
   */
  overwrite?: boolean
}

export class KlafDocument<T extends KlafDocumentable> {
  /**
   * It creates a new database file.
   * @param option The database creation options.
   */
  static async Create<
    S extends KlafDocumentable,
    T extends KlafDocumentScheme<S> = KlafDocumentScheme<S>
  >(option: KlafDocumentCreateOption<S, T>): Promise<KlafDocument<KlafDocumentSchemeType<S, T>>> {
    const bootloader = new KlafDocumentService.Bootloader()
    const journal = AuthenticatedDataJournal.From(KlafDocument, option.journal)

    await bootloader.create(option as any)
    const serviceParameter = await bootloader.open({ ...option, journal } as any)
    const service = new KlafDocumentService(serviceParameter)

    const instance = new KlafDocument({ service }) as unknown as KlafDocument<KlafDocumentSchemeType<S, T>>
    await instance.service.createTrees()

    return instance
  }

  /**
   * It opens or creates a database file at the specified path. 
   * @param option The database creation options.
   */
  static async Open<
    S extends KlafDocumentable,
    T extends KlafDocumentScheme<S> = KlafDocumentScheme<S>
  >(option: KlafDocumentCreateOption<S, T>): Promise<KlafDocument<KlafDocumentSchemeType<S, T>>> {
    const bootloader = new KlafDocumentService.Bootloader()
    
    const databaseExisting = await bootloader.existsDatabase(option.path, option.engine)
    if (!databaseExisting) {
      return KlafDocument.Create(option)
    }

    let journalExisting = false
    if (option.journal) {
      journalExisting = await bootloader.existsJournal(option.path, option.journal)
    }

    const journal = AuthenticatedDataJournal.From(KlafDocument, option.journal)
    const serviceParameter = await bootloader.open({ ...option, journal } as any)
    const service = new KlafDocumentService(serviceParameter)
    const instance = new KlafDocument({ service }) as unknown as KlafDocument<KlafDocumentSchemeType<S, T>>

    if (
      journalExisting &&
      service.core.journal?.isAccessible(KlafDocument)
    ) {
      await service.core.restoreJournal(KlafDocument)
      await instance.close()
      return await KlafDocument.Open(option)
    }
    await instance.service.createTrees()
    await instance.service.alterScheme(serviceParameter.schemeVersion)

    return instance
  }

  protected readonly service: KlafDocumentService<T>
  
  protected constructor({
    service
  }: KlafDocumentConstructorArguments<T>) {
    this.service = service
  }

  /**
   * Returns the metadata of the database.
   * This value is a state variable and any modifications will not be reflected in the database.
   * 
   * This metadata contains brief information about the database.
   * For example, the `metadata.autoIncrement` property indicates how many documents have been inserted into the database so far.
   */
  get metadata(): KlafDocumentMetadata {
    return this.service.metadata
  }

  get engine(): DataEngine {
    return this.service.engine
  }

  /**
   * Insert values into the database. These values must follow the JSON format and are referred to as documents.
   * 
   * A document consists of key-value pairs, for example, `{ name: 'john' }`. While documents can be nested, nested structures are not searchable.
   * For instance, you can insert a document like `{ information: { name: 'john' } }`, but you cannot search based on `information.name`.
   * 
   * If search functionality is required, store the relevant property separately as a top-level property.
   * @param document The document to be inserted.
   */
  async put(document: Partial<T>): Promise<CatchResult<KlafDocumentShape<T>>> {
    const transaction = async () => {
      const startRes  = await Catcher.CatchError(this.service.core.startBackup(KlafDocument))
      const putRes    = await Catcher.CatchError(this.service.put(document))
      const endRes    = await Catcher.CatchError(this.service.core.endBackup(KlafDocument))
      if (startRes[0])  return startRes
      if (endRes[0])    return endRes
      return putRes
    }
    return transaction()
  }

  /**
   * Deletes the document(s) inserted into the database. The data to be deleted can be specified using queries to define the scope.
   * @param query The scope of the documents to be deleted.
   * @returns The number of documents deleted.
   */
  async delete(query: KlafDocumentQuery<KlafDocumentShape<T>>): Promise<CatchResult<number>> {
    const transaction = async () => {
      const startRes  = await Catcher.CatchError(this.service.core.startBackup(KlafDocument))
      const deleteRes = await Catcher.CatchError(this.service.delete(query))
      const endRes    = await Catcher.CatchError(this.service.core.endBackup(KlafDocument))
      if (startRes[0])  return startRes
      if (endRes[0])    return endRes
      return deleteRes
    }
    return transaction()
  }

  /**
   * Updates a portion of the document(s) inserted into the database. You can specify the scope of the document to be updated using queries.
   * This method modifies only the specified properties without changing the entire document.  
   * 
   * For example, if there is a document `{ name: 'john', age: 20 }`, and you provide `{ age: 21 }` for updating, the document will become `{ name: 'john', age: 21 }`.
   * 
   * If it is a non-existing property, it will be inserted.  
   * For instance, with `{ student: true }`, the document will become `{ name: 'john', age: 20, student: true }`.
   * @param query The scope of the documents to be updated.
   * @param update The properties of the documents to be updated.
   * @returns The number of documents updated.
   */
  async partialUpdate(
    query: KlafDocumentQuery<KlafDocumentShape<T>>,
    update: Partial<T>|((record: KlafDocumentShape<T>) => Partial<T>)
  ): Promise<CatchResult<number>> {
    const transaction = async () => {
      const startRes  = await Catcher.CatchError(this.service.core.startBackup(KlafDocument))
      const updateRes = await Catcher.CatchError(this.service.partialUpdate(query, update))
      const endRes    = await Catcher.CatchError(this.service.core.endBackup(KlafDocument))
      if (startRes[0])  return startRes
      if (endRes[0])    return endRes
      return updateRes
    }
    return transaction()
  }

  /**
   * Updates the entire document(s) inserted into the database. You can specify the scope of the document to be updated using queries.
   * This method completely updates the inserted document.
   * 
   * For example, if there is a document `{ name: 'john', age: 20 }`, and you provide `{ name: 'park' }` for updating, the document will become `{ name: 'park' }`.
   * @param query The scope of the documents to be updated.
   * @param update The properties of the documents to be updated.
   * @returns The number of documents updated.
   */
  async fullUpdate(
    query: KlafDocumentQuery<KlafDocumentShape<T>>,
    update: T|((record: KlafDocumentShape<T>) => T)
  ): Promise<CatchResult<number>> {
    const transaction = async () => {
      const startRes  = await Catcher.CatchError(this.service.core.startBackup(KlafDocument))
      const updateRes = await Catcher.CatchError(this.service.fullUpdate(query, update))
      const endRes    = await Catcher.CatchError(this.service.core.endBackup(KlafDocument))
      if (startRes[0])  return startRes
      if (endRes[0])    return endRes
      return updateRes
    }
    return transaction()
  }

  /**
   * Retrieve documents inserted into the database using a query to specify the range of documents to be queried.  
   * Additionally, you can use the `options` parameter to specify the starting and ending indices of the query results and perform sorting.
   * @param query The range of documents to be queried.
   * @param option Modify the results of the retrieved documents.
   */
  async pick(
    query: KlafDocumentQuery<KlafDocumentShape<T>>,
    option: KlafDocumentOption<KlafDocumentShape<T>> = {}
  ): Promise<CatchResult<KlafDocumentShape<T>[]>> {
    return Catcher.CatchError(this.service.pick(query, option))
  }

  /**
   * It searches for and returns the number of documents that match the conditions.
   * Unlike the `pick` method, this method does not go through the parsing and sorting of documents, so it is much faster.
   * @param query The range of documents to be queried.
   * @returns The number of documents matched.
   */
  async count(query: KlafDocumentQuery<KlafDocumentShape<T>>): Promise<CatchResult<number>> {
    return Catcher.CatchError(this.service.count(query))
  }

  /**
   * Shut down the database to close file input and output.
   * The database does not close immediately due to delayed writing.
   * Therefore, this function operates asynchronously, and when the database is closed, the promise is resolved.
   * 
   * While the database is closing, you cannot perform read/write operations on the database.
   */
  async close(): Promise<CatchResult<void>> {
    return Catcher.CatchError(this.service.close())
  }
}
