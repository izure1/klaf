# Klaf with Key-value

This document covers the usage of the **key-value** database in **klaf**.

Unlike typical **key-value** databases, the key is automatically generated upon data insertion and **cannot** be directly specified by the user. Please take note of this distinction.

This database is suitable for a website that simply stores values in the database, generates URLs based on the retrieved key, and returns them to the user. If you need the ability to specify keys directly, consider using a [document-oriented](../document/README.md) database.

## Usage

```typescript
import { Klaf } from 'klaf.js'
import { FileSystemEngine } from 'klaf.js/engine/FileSystem'

// OPEN DB
const db = await Klaf.Open({
  path: 'my_file_path.db',
  engine: new FileSystemEngine(),
})

// INPUT
const data = 'Data string you want to store'
const [errPut, id] = await db.put(data)
const [errPick, result] = await db.pick(id)
result.record.payload // 'Data string you want to store'


// UPDATE
const modifiedData = 'Modified data string you want to store'
await db.update(id, modifiedData)

const [errPickModified, resultModified] = await db.pick(id)
resultModified.record.payload // 'Modified data string you want to store'

await db.update(id, 'POWER!!!')
const [errPickModified2, resultModified2] = await db.pick(id)
resultModified2.record.payload // 'POWER!!!'


// DELETE
await db.delete(id)
const [err, result2] = await db.pick(id)

if (err) {
  throw err // Error! The record was destroyed.
}


db.metadata.autoIncrement // 1
db.metadata.count // 0

// CLOSE DB
await db.close()
```
