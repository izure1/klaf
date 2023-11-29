# TissueRoll with Key-value

This document covers the usage of the **key-value** database in **tissue-roll**.

Unlike typical **key-value** databases, the key is automatically generated upon data insertion and **cannot** be directly specified by the user. Please take note of this distinction.

This database is suitable for a website that simply stores values in the database, generates URLs based on the retrieved key, and returns them to the user. If you need the ability to specify keys directly, consider using a [document-oriented](../document/README.md) database.

## Usage

```typescript
import { TissueRoll } from 'tissue-roll'

// OPEN DB
const payloadSize = 8192
const db = TissueRoll.Open('my_file_path.db', payloadSize)

// INPUT
const data = 'Data string you want to store'
const id = db.put(data)

db.pick(id).record.payload // 'Data string you want to store'


// UPDATE
const modifiedData = 'Modified data string you want to store'
db.update(id, modifiedData)
db.pick(id).record.payload // 'Modified data string you want to store'


// HOOK - When updating, add '!!!' after the data.
db.onBefore('update', (record) => {
  record.data += '!!!'
  return record
})

db.update(id, 'POWER')
db.pick(id).record.payload // 'POWER!!!'


// DELETE
db.delete(id)
db.pick(id) // Error! The record was destroyed.

// CLOSE DB
db.close()
```
