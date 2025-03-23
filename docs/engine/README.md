# Klaf Engines

**klaf** has introduced the concept of engines to support cross-platform compatibility. Engines are supported as ESM modules. You can choose an engine that suits your needs, or if necessary, extend an existing engine to create your own.

## TL;DR - Which one should I choose?

|  | Data persistence required. | Data persistence NO required. |
|-------|------|------|
| **Web Browser** | [WebWorkerEngine](#webworkerengine) | [InMemoryEngine](#inmemoryengine) |
| **Node.js, Bun, Deno** | [FileSystemEngine](#filesystemengine) | [InMemoryEngine](#inmemoryengine) |

## Available Engines

Currently, **klaf** supports three engines by default.

### FileSystemEngine

**FileSystemEngine** works exclusively in Node.js, Bun, Deno environments. It operates using Node.js's file system module, allowing the creation of database files on your computer to ensure data persistence.

```typescript
import { KlafDocument } from 'klaf.js'
import { FileSystemEngine } from 'klaf.js/engine/FileSystem'

const db = await KlafDocument.Open({
  path: 'your-database-path',
  engine: new FileSystemEngine(),
  version: 0,
  scheme: {
    ...
  }
})
```

This engine is used when you want to build a typical database. Although it only works in a JavaScript Runtime environment, it can store data permanently.

### InMemoryEngine

**InMemoryEngine** works in both JavaScript runtime and web browser environments. This engine does not create any files; it only stores data in the computer's memory. As a result, all data is lost when the instance is terminated.

```typescript
import { KlafDocument } from 'klaf.js'
import { InMemoryEngine } from 'klaf.js/engine/InMemory'

const db = await KlafDocument.Open({
  path: 'your-database-path',
  engine: new InMemoryEngine(),
  version: 0,
  scheme: {
    ...
  }
})
```

This engine offers high performance because it does not rely on file I/O operations from storage, making it ideal for use as a simple cache database.

### WebWorkerEngine

The **WebWorkerEngine** operates in the main thread, dedicated workers, shared workers, and service workers of the browser. It manages files using the browser's [OPFS (Origin Private File System)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) and the **FileSystemFileHandle API**, so please note that the files are not stored permanently.

```typescript
import { KlafDocument } from 'klaf.js'
import { WebWorkerEngine } from 'klaf.js/engine/WebWorker'

const db = await KlafDocument.Open({
  path: 'your-database-path',
  engine: new WebWorkerEngine(),
  version: 0,
  scheme: {
    ...
  }
})
```

This engine is useful when you want to create a database on the web and download it as a file. For example, if you're working on an online spreadsheet and want to save it as a database, you can use this method. Additionally, if you need a document-based database rather than a key-value store like IndexedDB, this engine can be a great alternative.

```typescript
// worker.js
postMessage(db.engine.fileHandle)

// main.js
worker.onmessage = async (e) => {
  const fileHandle = e.data
  const file = await fileHandle.getFile()
  const url = URL.createObjectURL(file)

  console.log(url) // Blob file download link
}
```

This engine utilizes the most optimal read/write strategies depending on the browser environment. For example, in dedicated web workers, the [createSyncAccessHandle](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle) synchronous method is supported, enabling fast read and write operations on files without loading the entire database into memory. However, this method is not available in shared workers, service workers, or the main thread.  

As a fallback, it uses the [getFile](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/getFile) and [createWritable](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable) methods. For performance optimization, this approach loads the entire database into memory during database operations, updates it in memory, and writes it back to the file using a write-back strategy. This process is resource-intensive, and as the database size increases, the performance will degrade significantly.

## Implementing Your Own Engine

If desired, you can implement your own engine. Below is an example of the class structure required for creating a custom engine.

```typescript
import { DataEngine } from 'klaf.js/engine/DataEngine'

class YourCustomEngine extends DataEngine {
  boot(file: string): Promise<void>
  exists(file: string): Promise<boolean>
  create(file: string, initialData: number[]): Promise<void>
  open(file: string): Promise<void>
  close(): Promise<void>
  unlink(file: string): Promise<void>
  size(): Promise<number>
  read(start: number, length: number): Promise<number[]>
  write(start: number, data: number[]): Promise<number[]>
  append(data: number[]): Promise<void>
  truncate(size: number): Promise<void>
}
```

Each method must be implemented by the user, and to implement them correctly, it's important to understand the engine's lifecycle. Below is pseudo code that outlines the order in which each method is called.

```typescript
await engine.boot(databasePath)

const databaseExisting = await engine.exists(databasePath)
const isOverwriting = option.overwrite

if (databaseExisting) {
  if (isOverwriting) {
    await engine.unlink(databasePath)
  }
  await engine.create(databasePath)
}
else {
  await engine.create(databasePath)
}

await engine.open(databasePath)
```

### boot(file: `string`): `Promise<void>`

This method is used for engine initialization before the database is used. Be aware that it may be called multiple times automatically. The parameter passed is the path of the database the user wants to open.

|Parameter|Description|
|---|---|
|`file`|The location of the database. This can be a file path or a key used for storage.|

### exists(file: `string`): `Promise<boolean>`

This method should return whether the database exists at the specified path.

|Parameter|Description|
|---|---|
|`file`|The location of the database. This can be a file path or a key used for storage.|

### create(file: `string`, initialData: `number[]`): `Promise<void>`

If the database does not exist, this method is called. Implement the logic to create a database file in this method. After creating the database, insert the **initialData** at the beginning. Below is an explanation of the parameters.

|Parameter|Description|
|---|---|
|`file`|The location where the database should be created. This can be a file path or a key used for storage.|
|`initialData`|An array of 8-bit positive integers. This is the root page data required for the database to function correctly. Insert this value at the very beginning of the database file.|

### open(file: `string`): `Promise<void>`

This method is called when the database is opened. You can handle tasks such as managing file descriptors (e.g., **fd**) within this method.

|Parameter|Description|
|---|---|
|`file`|The location of the database. This can be a file path or a key used for storage.|

### close(): `Promise<void>`

This method is called when the database is closed. You can use it to clean up any resources or data used by the database.

### unlink(file: `string`): `Promise<void>`

Unlinks the database file. This method is automatically called when the database needs to be deleted. After this method is called, the `exists` method must be able to return `false`.

|Parameter|Description|
|---|---|
|`file`|The location of the database. This can be a file path or a key used for storage.|

### size(): `Promise<number>`

This returns the size of the database. You should return the size of the database file in bytes.

### read(start: `number`, length: `number`): `Promise<number[]>`

This method implements reading part of the database file. It should return a byte array (as a number array) from a specific location in the file for the given length. Below is an explanation of the parameters.

|Parameter|Description|
|---|---|
|`start`|The byte offset from which to start reading the file.|
|`length`|The size of the data to read from the file.|

For example, if the **start** parameter is 100 and the **length** parameter is 10, you should return an array of 8-bit positive integers containing the byte codes from positions 100 to 110 in the file.

**Note:** If the file size is 105, you should return a number array of size 5 containing the byte codes from positions 100 to 105.

### update(start: `number`, data: `number[]`): `Promise<number[]>`

This method implements modifying part of the database file. You should modify the contents at a specific location in the file for the length of the **data** parameter array. Below is an explanation of the parameters.

|Parameter|Description|
|---|---|
|`start`|The byte offset at which to begin modifying the file.|
|`data`|The content to be updated in the file.|

For example, if the **start** parameter is 100 and the length of the **data** parameter is 10, the byte codes at positions 100 to 110 in the file should be modified with the values from the **data** parameter.

**Note:** If the file size is 105, only positions 100 to 105 should be modified, and only the modified 5 bytes should be returned as an array.

### append(data: `number[]`): `Promise<void>`

The values from the **data** parameter should be added to the end of the database file. This will increase the size of the database file.

|Parameter|Description|
|---|---|
|`data`|The content to be appended to the end of the database file.|

### truncate(size: `number`): `Promise<void>`

Truncates the database to the specified size.

|Parameter|Description|
|---|---|
|`size`|The size to truncate the database to.|
