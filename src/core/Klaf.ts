import { type StringValue } from 'cache-entanglement'
import {
  type KlafMetadata,
  type KlafPickResult,
  type KlafRecord,
  KlafPageType,
  KlafService,
} from './KlafService'
import { type CatchResult, Catcher } from '../utils/Catcher'
import { type DataEngine } from '../engine/DataEngine'

export interface KlafConstructorArguments {
  service: KlafService
}

export interface KlafCreateOption {
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
   * If this option is not set, the journal feature will be used.
   */
  journal?: boolean
  /**
   * This is the maximum data size a single page in the database can hold. The default is `4096`. If this value is too large or too small, it can affect performance.
   */
  payloadSize?: number
  /**
   * This decides whether to replace an existing database file at the path or create a new one. The default is `false`.
   */
  overwrite?: boolean
  /**
   * The time to wait before committing changes to the database. The default is `0`.
   * If you set this value to a positive number, the database will wait for the specified time before committing changes.
   * This can improve performance by reducing the number of write operations to the database.
   * However, it can also increase the risk of data loss if the application crashes before the changes are committed.
   */
  commitDebounce?: number
  /**
   * The maximum number of commit skips allowed before forcing a commit, even if `commitDebounce` time has not elapsed. The default is `10`.
   * If `commitDebounce` is set to a positive number, the database waits for the specified duration before committing changes.
   * If the application crashes before changes are committed, those changes are lost.
   * To mitigate this, the database will force a commit after `commitDebounceMaximumSkip` number of pending commits, regardless of the `commitDebounce` timer.
   * This helps reduce the risk of data loss in case of an application crash.
   */
  commitDebounceMaximumSkip?: number
  /**
   * If you set this value to a positive number, the database will keep the internal cache for this duration. This can improve performance.
   * However, it can also interfere with the garbage collector, leading to increased memory usage or preventing memory from being collected.
   * The default is `'3m'`.
   */
  cacheLifespan?: StringValue|number
}

export class Klaf {
  protected static GetService(instance: Klaf): KlafService {
    return instance.service
  }

  /**
   * It creates a new database file.
   * @param option The database creation options.
   */
  static async Create(option: KlafCreateOption): Promise<Klaf> {
    const bootloader = new KlafService.Bootloader()
    const loaderOpenParameter = await bootloader.create(option)
    const serviceParameter = await bootloader.open(loaderOpenParameter)
    const service = new KlafService(serviceParameter)
    
    await service.addEmptyPage({ type: KlafPageType.InternalType }, true)
    await service.engine.commit()

    const instance = new Klaf({ service })
    
    return instance
  }

  /**
   * It opens or creates a database file at the specified path. 
   * If `option.payloadSize` parameter value is specified as a positive number and there's no database file at the path, it will create a new one. The default is `4096`.
   * @param option The database creation options.
   */
  static async Open(option: KlafCreateOption): Promise<Klaf> {
    const bootloader = new KlafService.Bootloader()
    
    const databaseExisting = await bootloader.existsDatabase(option.path, option.engine)
    if (!databaseExisting) {
      return Klaf.Create(option)
    }
    const serviceParameter = await bootloader.open(option)
    const service = new KlafService(serviceParameter)
    
    const restored = await service.restoreJournal()
    if (restored) {
      await service.close()
      await service.engine._reset(option.path)
      return await Klaf.Open(option)
    }
    
    const instance = new Klaf({ service })
    return instance
  }

  protected readonly service: KlafService

  protected constructor({ service }: KlafConstructorArguments) {
    this.service = service
  }

  get metadata(): KlafMetadata {
    return this.service.metadata
  }

  protected async transaction<T>(work: () => Promise<T>, lockType: 'read'|'write' = 'write'): Promise<CatchResult<T>> {
    return Catcher.CatchError(this.service.transaction(work, lockType))
  }

  /**
   * You store data in the database and receive a record ID for the saved data.
   * This ID should be stored separately because it will be used in subsequent update, delete, and pick methods.
   * @param text The data string what you want store.
   * @returns The record id.
   */
  async put(text: string): Promise<CatchResult<string>> {
    return this.transaction(() => this.service.put(text), 'write')
  }

  /**
   * You store data in the database and receive a record ID for the saved data.
   * This ID should be stored separately because it will be used in subsequent update, delete, and pick methods.
   * @param texts The data strings what you want store.
   * @returns The record ids.
   */
  async batch(texts: string[]): Promise<CatchResult<string[]>> {
    return this.transaction(() => this.service.batch(texts), 'write')
  }

  /**
   * You update an existing record.
   * 
   * If the inserted data is shorter than the previous data, the existing record is updated.
   * Conversely, if the new data is longer, a new record is created.
   * 
   * These newly created records are called `alias record`, and when you call the `pick` method using the current record ID, the alias record is retrieved.
   * If an alias record existed previously, the existing alias record is deleted and can no longer be used.
   * @param recordId The record id what you want update.
   * @param text The data string what you want update.
   * @returns The record id.
   */
  async update(recordId: string, text: string): Promise<CatchResult<string>> {
    return this.transaction(() => this.service.update(recordId, text), 'write')
  }

  /**
   * You delete a record from the database, but it's not completely erased from the file. The record becomes unusable.
   * @param recordId The record id what you want delete.
   */
  async delete(recordId: string): Promise<CatchResult<void>> {
    return this.transaction(() => this.service.delete(recordId), 'write')
  }

  /**
   * Get record from database with a id.  
   * Don't pass an incorrect record ID. This does not ensure the validity of the record.
   * Use the `exists` method to validate the record id.
   * @param recordId The record id what you want pick.
   */
  async pick(recordId: string): Promise<CatchResult<KlafPickResult>> {
    return this.transaction(() => this.service.pick(recordId), 'read')
  }

  /**
   * It takes a page index as a parameter and returns a list of all records recorded on that page.  
   * The page index should be within the range of `1` to `instance.metadata.index`.
   * @param index The page index.
   */
  async getRecords(index: number): Promise<CatchResult<KlafRecord[]>> {
    return this.transaction(() => this.service.getRecords(index), 'read')
  }

  /**
   * It returns whether the record exists in the database.
   * If it has been deleted or has an invalid record ID, it returns `false`.
   * @param recordId The record id what you want verify.
   */
  async exists(recordId: string): Promise<CatchResult<boolean>> {
    return this.transaction(() => this.service.exists(recordId), 'read')
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
