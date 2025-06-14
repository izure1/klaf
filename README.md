# Klaf

[![jsdelivr](https://data.jsdelivr.com/v1/package/npm/klaf.js/badge)](https://www.jsdelivr.com/package/npm/klaf.js)
![node.js workflow](https://github.com/izure1/klaf/actions/workflows/node.js.yml/badge.svg)

Very simple read/write database with a **NoSQL**.  
It's written in JavaScript using pure Node.js API and pretty easy and small.  
This database works seamlessly with [Node.js](https://nodejs.org/), [Bun](https://bun.sh/) [Deno](https://deno.com/), and Browser, and Web worker.

Choose the [database](#database) and [engine](#engine) that best fit your needs to handle your data efficiently!

## :warning: Caution

`klaf.js` is currently under active development. Therefore, **its use in production environments is not yet recommended.**

You might consider using it in the following scenarios:

* **Toy Projects:** Small-scale projects for personal learning or experimental purposes.
* **Environments with Low Data Criticality:** Situations where the risk of data loss or alteration is acceptable.
* **Small-Scale Data:** When dealing with tens of thousands of records or fewer.

Please be aware that the following changes may occur during development:

* **API Changes:** Functions, classes, and interfaces within the library may change without notice.
* **Database File Structure Changes:** The internal structure of database files may be altered, potentially leading to incompatibility with previous versions. In such cases, existing database files might become unusable.

Until a stable version is released, please use `klaf.js` only in the recommended scenarios above or for testing and development purposes. For production environments involving critical or large-scale data, it is advisable to wait for the library to reach a sufficient level of stability.

## Database

**klaf** comes in two flavors: **key-value** database and **document-oriented** database.  
You have the freedom to choose based on your needs, **but most users will likely prefer the *document-oriented* database.**

For details on how to use each database, please refer to the links below.

* [**Document-oriented Database**](./docs/document/README.md)
* [**Key-value Database**](./docs/core/README.md)

## [Engine](./docs/engine/README.md)

Klaf.js introduces the concept of an engine, which is an instance responsible for handling how data is stored. Currently, three types of engines are supported by default: **FileSystem**, **InMemory**, and **WebWorker**. If needed, you can also create your own custom engine.  
Choose the engine that best fits your needs.

For a detailed list of the supported engines and more information, refer to [this link](./docs/engine/README.md).  
If you're unsure what to choose, select the **FileSystem** engine.

## Example

This example shows how to build a database using the document-oriented database **KlafDocument** and the **FileSystem** engine.

```typescript
import { KlafDocument } from 'klaf.js'
import { FileSystemEngine } from 'klaf.js/engine/FileSystem'

const db = await KlafDocument.Open({
  path: 'my-database-path.db',
  version: 0,
  engine: new FileSystemEngine(),
  scheme: {
    id: {
      default: () => crypto.randomUUID()
    },
    nickname: {
      default: () => 'Anonymous',
      validate: (v) => typeof v === 'string',
    },
    gender: {
      default: () => 'other',
      validate: (v) => ['male', 'female', 'other'].includes(v),
    }
  }
})

await db.put({ nickname: 'faker', gender: 'male' })
const [err, documents] = await db.pick({ gender: 'male' })
```

The following example demonstrates how to build a database using the key-value database **Klaf** and the **WebWorker** engine.

```typescript
import { Klaf } from 'klaf.js'
import { WebWorkerEngine } from 'klaf.js/engine/WebWorker'

const db = await Klaf.Open({
  path: 'my-database-path.db',
  engine: new WebWorkerEngine(),
})

const [errPut, key] = await db.put('Faker, GOAT.')
const [errPick, row] = await db.pick(key)
row.record.payload // "Faker, GOAT."
```

## Install

### Node.js (NPM)

```bash
npm i klaf.js
```

### Deno (JSR)

```bash
deno add jsr:@izure/klaf
```

### Browser (ESM)

```javascript
import { Klaf, KlafDocument } from 'https://cdn.jsdelivr.net/npm/klaf.js@3/dist/esm/index.mjs'

// engines
import { InMemoryEngine } from 'https://cdn.jsdelivr.net/npm/klaf.js@3/dist/esm/engine/InMemory.mjs'
import { WebWorkerEngine } from 'https://cdn.jsdelivr.net/npm/klaf.js@3/dist/esm/engine/WebWorker.mjs'
```

## Why

### Why use **klaf**?

JavaScript has numerous fantastic database libraries available, but at times, they can seem overly complex.  
This particular solution is ideal for situations where you need to store data for an extended period, making it well-suited for less critical data that doesn't require a rigid structure.

Since it is implemented in pure JavaScript, there is no need for pre-builds or configuration based on the Node.js version. It is compatible with all versions!

### Why should I use this instead of **JSON**?

When the **JSON** files get large, quick data read and write operations can become challenging.  
**klaf** handles data input and output in real-time, ensuring fast and lightweight performance. Check the performance tests below.

## How

### How does **klaf** work?

**klaf** manages files by breaking them into logical blocks called pages. You can set the page size when creating the database.

When you insert data, the ID you get back includes information about where the data is stored on the page. This makes it possible to work with large files quickly. This value could be seen by users, but it's encrypted to make it hard to predict. This way, it stops users from trying to steal data by requesting fake record IDs.

### How many can I own data?

**klaf** can make a unsigned 32bit range of page block. This is a **4,294,967,296**. And each page can own unsigned 32bit range of records also. So you can theoretically insert **4,294,967,295** * **4,294,967,295** records.

## Performance Test

The test result is the average value from 10 attempts.  
The latest performance benchmarking was conducted based on version **2.0.6**. This test was conducted using the **FileSystem** engine, and it was tested without the **Journal** feature.

**klaf** supports two databases, and this test tested the core functions of data reading/writing of the two databases. Therefore, it's not a perfect test result, but it's enough to show the time complexity.

If you're adding data to the database in real-time, the results would be as follows:

### WRITE

Overall, Klaf supports faster writes than JSON. As the size increases, this gap becomes even larger.

|`WRITE`|JSON|KLAF|`RESULT`|
|---|---|---|---|
|1,000 times|1014ms|864ms|***+15% Faster***|
|2,000 times|2200ms|1700ms|***+23% Faster***|
|4,000 times|5674ms|3163ms|***+44% Faster***|
|8,000 times|15332ms|5925ms|***+61% Faster***|

### READ

**klaf** maintains a steady reading speed no matter the database size. In contrast, JSON files slow down as they get bigger.

|`READ`|JSON|KLAF|`RESULT`|
|---|---|---|---|
|from 8,000 records|1.8ms|2ms|*-10% Slower*|
|from 16,000 records|4ms|2ms|***+100% Faster***|
|from 32,000 records|5.4ms|2ms|***+170% Faster***|
|from 64,000 records|11.4ms|2ms|***+470% Faster***|
|from 128,000 records|26.4ms|2ms|***+1220% Faster***|

### RESULT

![WRITE](./docs/asset/image/svg_perf_write.svg)
![READ](./docs/asset/image/svg_perf_read.svg)

**NOTICE!**

*This is the usual case, but the results can be different depending on programming optimizations. Please note that this test takes a square of the sample size to easily show the error with a small number of tests. Therefore, the graph appears to increase exponentially, but in terms of time complexity, JSON has **O(n)**, and klaf has a speed of **O(1)** or **O(log n)**.*

*The Journal feature is designed to enhance database stability. However, it may slightly reduce performance, approximately by **25~30%**.*

## Repository

|Site|Link|
|---|---|
|**NPM**|[View](https://www.npmjs.com/package/klaf.js)|
|**JSR**|[View](https://jsr.io/@izure/klaf)|
|**jsdelivr**|[View](https://www.jsdelivr.com/package/npm/klaf.js)|
|**Github**|[View](https://github.com/izure1/klaf)|

## Migration

The Klaf library is the new name for the TissueRoll library.

|     Version                         |     Link      |
|-------------------------------------|---------------|
| From Klaf 3.x to Klaf 4.x           |[Link](./docs/migration/9.md)|
| From Klaf 2.x to Klaf 3.x           |[Link](./docs/migration/8.md)|
| From Klaf 1.x to Klaf 2.x           |[Link](./docs/migration/7.md)|
| From TissueRoll 5.x.x to Klaf 1.x   |[Link](./docs/migration/6.md)|

## License

MIT LICENSE
