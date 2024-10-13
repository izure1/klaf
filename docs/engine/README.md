# Klaf Engines

**klaf** has introduced the concept of engines to support cross-platform compatibility. Engines are supported as ESM modules. You can choose an engine that suits your needs, or if necessary, extend an existing engine to create your own.

## Available Engines

Currently, **klaf** supports three engines by default.

### FileSystemEngine

**FileSystemEngine** works exclusively in Node.js environments. It operates using Node.js's file system module, allowing the creation of database files on your computer to ensure data persistence.

```typescript
import { KlafDocument } from 'klaf.js'
import { FileSystemEngine } from 'klaf.js/engine/FileSystem'

const engine = new FileSystemEngine()
const db = await KlafDocument.Open({
  path: 'your-database-path',
  engine,
  version: 0,
  scheme: {
    ...
  }
})
```

This engine is used when you want to build a typical database. Although it only works in a Node.js environment, it can store data permanently.

### InMemoryEngine

**InMemoryEngine** works in both Node.js and browser environments. This engine does not create any files; it only stores data in the computer's memory. As a result, all data is lost when the instance is terminated.

```typescript
import { KlafDocument } from 'klaf.js'
import { InMemoryEngine } from 'klaf.js/engine/InMemory'

const engine = new InMemoryEngine()
const db = await KlafDocument.Open({
  path: 'your-database-path',
  engine,
  version: 0,
  scheme: {
    ...
  }
})
```

This engine offers high performance because it does not rely on file I/O operations from storage, making it ideal for use as a simple cache database.

### WebWorkerEngine

**WebWorkerEngine** operates exclusively in the dedicated web worker environment of browsers. It uses the browser's **FileSystemFileHandle API** to manage files. However, if multiple tabs are opened, a separate database will be created for each web worker. When a tab is closed, the corresponding database file will be automatically deleted.

```typescript
import { KlafDocument } from 'klaf.js'
import { WebWorkerEngine } from 'klaf.js/engine/WebWorker'

const engine = new WebWorkerEngine()
const db = await KlafDocument.Open({
  path: 'your-database-path',
  engine,
  version: 0,
  scheme: {
    ...
  }
})
```

This engine is useful when you want to create a database on the web and download it as a file. Please note that it does not store data permanently. For instance, if you're working on an online spreadsheet and want to save it as a database, you can use this method.

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
  size(): number
  read(start: number, length: number): number[]
  write(start: number, data: number[]): number[]
  append(data: number[]): void
}
```

Each method must be implemented by the user, and to implement them correctly, it's important to understand the engine's lifecycle. Below is pseudo code that outlines the order in which each method is called.

```typescript
await engine.boot(databasePath)

const databaseExisting = await engine.exists(databasePath)

if (!databaseExisting) {
  await engine.create(databasePath)
}

await engine.open(engine.exists(databasePath))
```

### boot(file: `string`): `Promise<void>`

This method is used for engine initialization before the database is opened. Be aware that it may be called multiple times automatically. The parameter passed is the path of the database the user wants to open.

### exists(file: `string`): `Promise<boolean>`

This method should return whether the database exists at the specified path.

### create(file: `string`, initialData: `number[]`): `Promise<void>`

If the database does not exist, this method is called. Implement the logic to create a database file in this method. After creating the database, insert the **initialData** at the beginning. Below is an explanation of the parameters.

|Parameter|Description|
|---|---|
|`file`|The location where the database should be created.|
|`initialData`|An array of 8-bit positive integers. This is the root page data required for the database to function correctly. Insert this value at the very beginning of the database file.|

### open(file: `string`): `Promise<void>`

This method is called when the database is opened. You can handle tasks such as managing file descriptors (e.g., **fd**) within this method.

### close(): `Promise<void>`

This method is called when the database is closed. You can use it to clean up any resources or data used by the database.

### size(): `number`

This returns the size of the database. You should return the size of the database file in bytes.

### read(start: `number`, length: `number`): `number[]`

This method implements reading part of the database file. It should return a byte array (as a number array) from a specific location in the file for the given length. Below is an explanation of the parameters.

|Parameter|Description|
|---|---|
|`start`|The byte offset from which to start reading the file.|
|`length`|The size of the data to read from the file.|

For example, if the **start** parameter is 100 and the **length** parameter is 10, you should return an array of 8-bit positive integers containing the byte codes from positions 100 to 110 in the file.

**Note:** If the file size is 105, you should return a number array of size 5 containing the byte codes from positions 100 to 105.

### update(start: `number`, data: `number[]`): `number[]`

This method implements modifying part of the database file. You should modify the contents at a specific location in the file for the length of the **data** parameter array. Below is an explanation of the parameters.

|Parameter|Description|
|---|---|
|`start`|The byte offset at which to begin modifying the file.|
|`data`|The content to be updated in the file.|

For example, if the **start** parameter is 100 and the length of the **data** parameter is 10, the byte codes at positions 100 to 110 in the file should be modified with the values from the **data** parameter.

**Note:** If the file size is 105, only positions 100 to 105 should be modified, and only the modified 5 bytes should be returned as an array.

### append(data: `number[]`): `void`

The values from the **data** parameter should be added to the end of the database file. This will increase the size of the database file.
