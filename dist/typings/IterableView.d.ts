export declare class IterableView {
    static Read<T>(array: T[], start: number, length?: number): T[];
    static Update<T>(array: T[], start: number, data: T[]): T[];
    static Ensure<T>(array: T[], len: number, fill: T): T[];
}
export declare class FileView {
    static Size(fd: number): number;
    static Read(fd: number, start: number, length?: number): number[];
    static Update(fd: number, start: number, data: number[]): number[];
    static Append(fd: number, data: number[]): void;
}
