export declare class ErrorBuilder {
    static ERR_DB_ALREADY_EXISTS(file: string): Error;
    static ERR_DB_INVALID(file: string): Error;
    static ERR_DB_NO_EXISTS(file: string): Error;
    static ERR_ALREADY_DELETED(recordId: number): Error;
}
