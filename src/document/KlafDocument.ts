import { KlafCreateOption } from '../core/Klaf'
import {
  type CatchResult,
  Catcher
} from '../utils/Catcher'
import {
  type KlafDocumentable,
  type KlafDocumentScheme,
  type KlafDocumentMetadata,
  type KlafDocumentOption,
  type KlafDocumentQuery,
  type KlafDocumentSchemeType,
  type KlafDocumentShape,
  KlafDocumentService,
} from './KlafDocumentService'

export interface KlafDocumentConstructorArguments<T extends KlafDocumentable> {
  service: KlafDocumentService<T>
}

export interface KlafDocumentCreateOption<
  S extends KlafDocumentable,
  T extends KlafDocumentScheme<S>
> extends KlafCreateOption {
  /**
   * Scheme version.
   */
  version: number
  /**
   * The fields of the database scheme and their validation functions.
   * The property names become field names, and their values perform validation when inserting or updating values.
   * Please refer to the example below.
   * ```
   * const db = await KlafDocument.Open({
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
    const loaderOpenParameter = await bootloader.create(option)
    const serviceParameter = await bootloader.open(loaderOpenParameter)
    const service = new KlafDocumentService(serviceParameter)

    const instance = new KlafDocument({ service }) as unknown as KlafDocument<KlafDocumentSchemeType<S, T>>
    await instance.service.createBTrees()

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

    const serviceParameter = await bootloader.open(option)
    const service = new KlafDocumentService(serviceParameter)
    
    const restored = await service.core.restoreJournal()
    if (restored) {
      await service.close()
      return await KlafDocument.Open(option)
    }
    
    const instance = new KlafDocument({ service }) as unknown as KlafDocument<KlafDocumentSchemeType<S, T>>
    await instance.service.createBTrees()
    const altered = await instance.service.alterScheme(serviceParameter.schemeVersion)
    if (altered) {
      instance.service.clearBTrees()
      await instance.service.createBTrees()
    }

    return instance
  }

  protected readonly service: KlafDocumentService<T>
  
  protected constructor({ service }: KlafDocumentConstructorArguments<T>) {
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

  protected async transaction<T>(work: () => Promise<T>, lockType: 'read'|'write' = 'write'): Promise<CatchResult<T>> {
    return Catcher.CatchError(this.service.transaction(work, lockType))
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
    return this.transaction(() => this.service.put(document), 'write')
  }

  /**
   * Insert values into the database. These values must follow the JSON format and are referred to as documents.
   * 
   * A document consists of key-value pairs, for example, `{ name: 'john' }`. While documents can be nested, nested structures are not searchable.
   * For instance, you can insert a document like `{ information: { name: 'john' } }`, but you cannot search based on `information.name`.
   * 
   * If search functionality is required, store the relevant property separately as a top-level property.
   * @param documents The documents to be inserted.
   */
  async batch(documents: Partial<T>[]): Promise<CatchResult<KlafDocumentShape<T>[]>> {
    return this.transaction(() => this.service.batch(documents), 'write')
  }

  /**
   * Deletes the document(s) inserted into the database. The data to be deleted can be specified using queries to define the scope.
   * @param query The scope of the documents to be deleted.
   * @returns The number of documents deleted.
   */
  async delete(query: KlafDocumentQuery<KlafDocumentShape<T>>): Promise<CatchResult<number>> {
    return this.transaction(() => this.service.delete(query), 'write')
  }

  /**
   * Insert or update values into the database. These values must follow the JSON format and are referred to as documents.
   * If the query matches existing documents, those documents will be updated with the provided `document` data.
   * If the query does not match any existing documents, a new document will be inserted with the provided `document` data.
   * @param query The range of documents to be updated or inserted.
   * @param document The document to be inserted or updated.
   * @returns The inserted document if no documents matched the query, or the number of documents updated if documents matched the query.
   */
  async putOrUpdate(
    query: KlafDocumentQuery<KlafDocumentShape<T>>,
    document: Partial<T>,
  ): Promise<CatchResult<KlafDocumentShape<T>|number>> {
    return this.transaction(() => this.service.putOrUpdate(query, document), 'write')
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
    return this.transaction(() => this.service.partialUpdate(query, update), 'write')
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
    return this.transaction(() => this.service.fullUpdate(query, update), 'write')
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
    return this.transaction(() => this.service.pick(query, option), 'read')
  }

  /**
   * It searches for and returns the number of documents that match the conditions.
   * Unlike the `pick` method, this method does not go through the parsing and sorting of documents, so it is much faster.
   * @param query The range of documents to be queried.
   * @returns The number of documents matched.
   */
  async count(query: KlafDocumentQuery<KlafDocumentShape<T>>): Promise<CatchResult<number>> {
    return this.transaction(() => this.service.count(query), 'read')
  }

  /**
   * Shut down the database to close file input and output.
   * The database does not close immediately due to delayed writing.
   * Therefore, this function operates asynchronously, and when the database is closed, the promise is resolved.
   * 
   * While the database is closing, you cannot perform read/write operations on the database.
   */
  async close(): Promise<CatchResult<void>> {
    return this.transaction(() => this.service.close(), 'read')
  }
}
