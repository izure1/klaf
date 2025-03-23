import {
  type KlafMetadata,
  type KlafPickResult,
  type KlafRecord,
  KlafPageType,
  KlafService,
} from './KlafService'
import {
  type DataJournalContainer,
  AuthenticatedDataJournal,
  DataJournal,
} from '../engine/DataJournal'
import { type CatchResult, Catcher } from '../utils/Catcher'
import { DataEngine } from '../engine/DataEngine'

export interface KlafConstructorArguments {
  service: KlafService
  journal?: DataJournal
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
   * This is the maximum data size a single page in the database can hold. The default is `1024`. If this value is too large or too small, it can affect performance.
   */
  payloadSize?: number
  /**
   * This decides whether to replace an existing database file at the path or create a new one. The default is `false`.
   */
  overwrite?: boolean
}

export class Klaf implements DataJournalContainer {
  protected static GetService(instance: Klaf): KlafService {
    return instance.service
  }

  /**
   * It creates a new database file.
   * @param option The database creation options.
   */
  static async Create(option: KlafCreateOption): Promise<Klaf> {
    const bootloader = new KlafService.Bootloader()
    const journal = AuthenticatedDataJournal.From(Klaf, option.journal)

    await bootloader.create({ ...option, journal })
    const serviceParameter = await bootloader.open({ ...option, journal })
    const service = new KlafService(serviceParameter)
    
    await service.addEmptyPage({ type: KlafPageType.InternalType }, true)
    const instance = new Klaf({ service, journal })
    
    return instance
  }

  /**
   * It opens or creates a database file at the specified path. 
   * If `option.payloadSize` parameter value is specified as a positive number and there's no database file at the path, it will create a new one. The default is `1024`.
   * @param option The database creation options.
   */
  static async Open(option: KlafCreateOption): Promise<Klaf> {
    const bootloader = new KlafService.Bootloader()
    
    const databaseExisting = await bootloader.existsDatabase(option.path, option.engine)
    if (!databaseExisting) {
      return Klaf.Create(option)
    }

    let journalExisting = false
    if (option.journal) {
      journalExisting = await bootloader.existsJournal(option.path, option.journal)
    }
    
    const journal = AuthenticatedDataJournal.From(Klaf, option.journal)
    const serviceParameter = await bootloader.open({ ...option, journal })
    const service = new KlafService(serviceParameter)

    const instance = new Klaf({ service, journal })

    if (
      journalExisting &&
      service.journal?.isAccessible(Klaf)
    ) {
      await service.restoreJournal(Klaf)
      await instance.close()
      return await Klaf.Open(option)
    }
    
    return instance
  }

  protected readonly service: KlafService
  readonly journal?: DataJournal

  protected constructor({ service, journal }: KlafConstructorArguments) {
    this.service = service
    this.journal = journal
  }

  get metadata(): KlafMetadata {
    return this.service.metadata
  }

  /**
   * Get record from database with a id.  
   * Don't pass an incorrect record ID. This does not ensure the validity of the record.
   * Use the `exists` method to validate the record id.
   * @param recordId The record id what you want pick.
   */
  async pick(recordId: string): Promise<CatchResult<KlafPickResult>> {
    return await Catcher.CatchError(this.service.pick(recordId))
  }

  /**
   * You store data in the database and receive a record ID for the saved data.
   * This ID should be stored separately because it will be used in subsequent update, delete, and pick methods.
   * @param text The data string what you want store.
   * @returns The record id.
   */
  async put(text: string): Promise<CatchResult<string>> {
    const transaction = async () => {
      const startRes  = await Catcher.CatchError(this.service.startBackup(Klaf))
      const putRes    = await Catcher.CatchError(this.service.put(text))
      const endRes    = await Catcher.CatchError(this.service.endBackup(Klaf))
      if (startRes[0])  return startRes
      if (endRes[0])    return endRes
      return putRes
    }
    return transaction()
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
    const transaction = async () => {
      const startRes  = await Catcher.CatchError(this.service.startBackup(Klaf))
      const updateRes = await Catcher.CatchError(this.service.update(recordId, text))
      const endRes    = await Catcher.CatchError(this.service.endBackup(Klaf))
      if (startRes[0])  return startRes
      if (endRes[0])    return endRes
      return updateRes
    }
    return transaction()
  }

  /**
   * You delete a record from the database, but it's not completely erased from the file. The record becomes unusable.
   * @param recordId The record id what you want delete.
   */
  async delete(recordId: string): Promise<CatchResult<void>> {
    const transaction = async () => {
      const startRes  = await Catcher.CatchError(this.service.startBackup(Klaf))
      const deleteRes = await Catcher.CatchError(this.service.delete(recordId))
      const endRes    = await Catcher.CatchError(this.service.endBackup(Klaf))
      if (startRes[0])  return startRes
      if (endRes[0])    return endRes
      return deleteRes
    }
    return transaction()
  }

  /**
   * It takes a page index as a parameter and returns a list of all records recorded on that page.  
   * The page index should be within the range of `1` to `instance.metadata.index`.
   * @param index The page index.
   */
  async getRecords(index: number): Promise<CatchResult<KlafRecord[]>> {
    const transaction = async () => {
      const startRes  = await Catcher.CatchError(this.service.startBackup(Klaf))
      const getRes    = await Catcher.CatchError(this.service.getRecords(index))
      const endRes    = await Catcher.CatchError(this.service.endBackup(Klaf))
      if (startRes[0])  return startRes
      if (endRes[0])    return endRes
      return getRes
    }
    return transaction()
  }

  /**
   * It returns whether the record exists in the database.
   * If it has been deleted or has an invalid record ID, it returns `false`.
   * @param recordId The record id what you want verify.
   */
  async exists(recordId: string): Promise<CatchResult<boolean>> {
    const transaction = async () => {
      const startRes  = await Catcher.CatchError(this.service.startBackup(Klaf))
      const existsRes = await Catcher.CatchError(this.service.exists(recordId))
      const endRes    = await Catcher.CatchError(this.service.endBackup(Klaf))
      if (startRes[0])  return startRes
      if (endRes[0])    return endRes
      return existsRes
    }
    return transaction()
  }

  /**
   * Shut down the database to close file input and output.
   * The database does not close immediately due to delayed writing.
   * Therefore, this function operates asynchronously, and when the database is closed, the promise is resolved.
   * 
   * While the database is closing, you cannot perform read/write operations on the database.
   */
  async close(): Promise<CatchResult<void>> {
    return Catcher.CatchError(this.service.close(Klaf))
  }
}
