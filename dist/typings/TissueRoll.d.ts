import type { FpeCipher } from 'node-fpe';
type IPageHeader = {
    type: number;
    index: number;
    next: number;
    count: number;
    free: number;
};
type IRootHeader = {
    majorVersion: number;
    minorVersion: number;
    patchVersion: number;
    payloadSize: number;
    timestamp: bigint;
    secretKey: bigint;
    index: number;
};
export declare class TissueRoll {
    protected static DB_VERSION: string;
    protected static DB_NAME: string;
    protected static RootValidStringOffset: number;
    protected static RootValidStringSize: number;
    protected static RootMajorVersionOffset: number;
    protected static RootMajorVersionSize: number;
    protected static RootMinorVersionOffset: number;
    protected static RootMinorVersionSize: number;
    protected static RootPatchVersionOffset: number;
    protected static RootPatchVersionSize: number;
    protected static RootIndexOffset: number;
    protected static RootIndexSize: number;
    protected static RootPayloadSizeOffset: number;
    protected static RootPayloadSizeSize: number;
    protected static RootTimestampOffset: number;
    protected static RootTimestampSize: number;
    protected static RootSecretKeyOffset: number;
    protected static RootSecretKeySize: number;
    protected static RootChunkSize: number;
    protected static HeaderSize: number;
    protected static CellSize: number;
    protected static RecordHeaderSize: number;
    protected static RecordHeaderIndexOffset: number;
    protected static RecordHeaderIndexSize: number;
    protected static RecordHeaderOrderOffset: number;
    protected static RecordHeaderOrderSize: number;
    protected static RecordHeaderSaltOffset: number;
    protected static RecordHeaderSaltSize: number;
    protected static RecordHeaderLengthOffset: number;
    protected static RecordHeaderLengthSize: number;
    protected static RecordHeaderMaxLengthOffset: number;
    protected static RecordHeaderMaxLengthSize: number;
    protected static RecordHeaderDeletedOffset: number;
    protected static RecordHeaderDeletedSize: number;
    protected static RecordHeaderAliasIndexOffset: number;
    protected static RecordHeaderAliasIndexSize: number;
    protected static RecordHeaderAliasOrderOffset: number;
    protected static RecordHeaderAliasOrderSize: number;
    protected static RecordHeaderAliasSaltOffset: number;
    protected static RecordHeaderAliasSaltSize: number;
    protected static UnknownType: number;
    protected static InternalType: number;
    protected static OverflowType: number;
    protected static SystemReservedType: number;
    /**
     * It creates a new database file.
     * @param file This is the path where the database file will be created.
     * @param payloadSize This is the maximum data size a single page in the database can hold. The default is `8192`. If this value is too large or too small, it can affect performance.
     * @param overwrite This decides whether to replace an existing database file at the path or create a new one. The default is `false`.
     */
    static Create(file: string, payloadSize?: number, overwrite?: boolean): TissueRoll;
    /**
     * It opens or creates a database file at the specified path.
     * If `payloadSize` parameter value is specified as a positive number and there's no database file at the path, it will create a new one.
     * @param file This is the path where the database file is located.
     * @param payloadSize If this value is specified as a positive number and there's no database file at the path, it will create a new one. The default is `0`.
     */
    static Open(file: string, payloadSize?: number): TissueRoll;
    protected static ParseRootChunk(fd: number): IRootHeader;
    protected static CreateIterable(len: number, fill: number): number[];
    protected static CheckDBValid(fd: number): boolean;
    protected readonly chunkSize: number;
    protected readonly headerSize: number;
    protected readonly payloadSize: number;
    protected readonly fd: number;
    protected readonly secretKey: string;
    protected readonly fpe: FpeCipher;
    protected constructor(fd: number, secretKey: string, payloadSize: number);
    get root(): IRootHeader;
    private _createEmptyHeader;
    private _createEmptyPayload;
    private _createEmptyPage;
    private _addEmptyPage;
    private _pagePosition;
    private _pagePayloadPosition;
    private _cellPosition;
    private _createSalt;
    private _recordPosition;
    private _get;
    private _recordId;
    private _normalizeRecordId;
    private _rawRecordId;
    private _createRecord;
    private _createCell;
    private _getRecord;
    private _normalizeRecord;
    private _getHeader;
    private _normalizeHeader;
    private _getHeadPageIndex;
    protected pickRecord(recordId: string, recursiveAlias: boolean): {
        page: ReturnType<TissueRoll['_normalizeHeader']>;
        record: ReturnType<TissueRoll['_normalizeRecord']>;
        order: number;
    };
    /**
     * Get record from database with a id.
     * Don't pass an incorrect record ID. This does not ensure the validity of the record.
     * If you pass an incorrect record ID, it may result in returning non-existent or corrupted records.
     * @param recordId The record id what you want pick.
     */
    pick(recordId: string): {
        page: IPageHeader;
        record: {
            rawRecord: number[];
            rawHeader: number[];
            rawPayload: number[];
            header: {
                id: string;
                aliasId: string;
                index: number;
                order: number;
                salt: number;
                aliasIndex: number;
                aliasOrder: number;
                aliasSalt: number;
                length: number;
                maxLength: number;
                deleted: number;
            };
            payload: string;
        };
        order: number;
    };
    private _putPageHeader;
    private _putPagePayload;
    private _putJustOnePage;
    private _put;
    /**
     * Shut down the database to close file input and output.
     */
    close(): void;
    /**
     * You store data in the database and receive a record ID for the saved data. This ID should be stored separately because it will be used in subsequent update, delete, and pick methods.
     * @param data The data string what you want store.
     * @returns The record id.
     */
    put(data: string): string;
    /**
     * You update an existing record.
     *
     * If the inserted data is shorter than the previous data, the existing record is updated.
     * Conversely, if the new data is longer, a new record is created.
     *
     * These newly created records are called `alias record`, and when you call the `pick` method using the current record ID, the alias record is retrieved.
     * If an alias record existed previously, the existing alias record is deleted and can no longer be used.
     * @param recordId The record id what you want update.
     * @param data The data string what you want update.
     * @returns The record id.
     */
    update(recordId: string, data: string): string;
    private _delete;
    /**
     * You delete a record from the database, but it's not completely erased from the file. The record becomes unusable.
     * @param recordId The record id what you want delete.
     */
    delete(recordId: string): void;
    /**
     * It returns whether the record exists in the database. If it has been deleted or has an invalid record ID, it returns `false`.
     * @param recordId The record id what you want verify.
     */
    exists(recordId: string): boolean;
}
export {};
