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
    timestamp: number;
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
    protected static RootChunkSize: number;
    protected static HeaderSize: number;
    protected static CellSize: number;
    protected static RecordHeaderSize: number;
    protected static RecordHeaderIndexSize: number;
    protected static RecordHeaderLengthSize: number;
    protected static RecordHeaderMaxLengthSize: number;
    protected static RecordHeaderDeletedSize: number;
    protected static RecordHeaderIndexOffset: number;
    protected static RecordHeaderLengthOffset: number;
    protected static RecordHeaderMaxLengthOffset: number;
    protected static RecordHeaderDeletedOffset: number;
    protected static UnknownType: number;
    protected static InternalType: number;
    protected static OverflowType: number;
    protected static SystemReservedType: number;
    /**
     * It creates a new database file.
     * @param file This is the path where the database file will be created.
     * @param payloadSize This is the maximum data size a single page in the database can hold. The default is `1024`. If this value is too large or too small, it can affect performance.
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
    protected constructor(fd: number, payloadSize: number);
    get root(): IRootHeader;
    private _createEmptyHeader;
    private _createEmptyPayload;
    private _createEmptyPage;
    private _addEmptyPage;
    private _pagePosition;
    private _pagePayloadPosition;
    private _cellPosition;
    private _recordPosition;
    private _get;
    private _recordId;
    private _recordIdFromRaw;
    private _normalizeRecordId;
    private _rawRecordId;
    private _createRecord;
    private _createCell;
    private _getRecord;
    private _normalizeRecord;
    private _getHeader;
    private _normalizeHeader;
    private _getHeadPageIndex;
    /**
     * Get record from database with a id.
     * Don't pass an incorrect record ID. This does not ensure the validity of the record.
     * If you pass an incorrect record ID, it may result in returning non-existent or corrupted records.
     * @param recordId The record id what you want pick.
     */
    pick(recordId: number): {
        page: IPageHeader;
        record: {
            rawRecord: number[];
            rawHeader: number[];
            rawPayload: number[];
            header: {
                index: number;
                length: number;
                maxLength: number;
                deleted: number;
            };
            payload: string;
        };
        order: number;
    };
    private _putPageHead;
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
    put(data: string): number;
    /**
     * You can update an existing record.
     * If the new data is smaller, it replaces the old one. If it's larger, a new record is created, and you get its ID. In this case, the old record is deleted and can't be used anymore.
     * @param recordId The record id what you want update.
     * @param data The data string what you want update.
     * @returns The updated record id.
     */
    update(recordId: number, data: string): number;
    /**
     * You delete a record from the database, but it's not completely erased from the file. The record becomes unusable.
     * @param recordId The record id what you want delete.
     */
    delete(recordId: number): void;
}
export {};
