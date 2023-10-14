# Tissue Roll

Very simple read/write database with a `key-value`.  
It's written in JavaScript using pure Node.js API and has no dependencies.

## Usage

```typescript
import { TissueRoll } from 'tissue-roll'

// OPEN DB
const payloadSize = 1024
const db = TissueRoll.Open('my_file_path.db', payloadSize)

// INPUT
const data = 'Data string you want to store'
const id = db.put(data)

db.pick(id).record.payload // 'Data string you want to store'


// UPDATE
const modifiedData = 'Modified data string you want to store'
const updatedId = db.update(id, modifiedData)

db.pick(updatedId).record.payload // 'Modified data string you want to store'

// DELETE
db.delete(updatedId)
db.pick(updatedId) // Error! The record was destroyed.


// CLOSE DB
db.close()
```

## Install

|Site|Link|
|---|---|
|**NPM**|[View](https://www.npmjs.com/package/tissue-roll)|
|**Github**|[View](https://github.com/izure1/tissue-roll)|

## API

### Static Functions

#### TissueRoll.Create(file: `string`, payloadSize = `1024`, overwrite = `false`): `TissueRoll`

It creates a new database file.

#### TissueRoll.Open(file: `string`, payloadSize = `0`): `TissueRoll`

It opens or creates a database file at the specified path. If `payloadSize` parameter value is specified as a positive number and there's no database file at the path, it will create a new one.

### Methods

#### put(data: `string`): `number`

You store data in the database and receive a record ID for the saved data. This ID should be stored separately because it will be used in subsequent update, delete, and pick methods.

#### update(recordId: `number`, data: `string`): `number`

You can update an existing record.  
If the new data is smaller, it replaces the old one. If it's larger, a new record is created, and you get its ID. In this case, the old record is deleted and can't be used anymore.

#### delete(recordId: `number`): `void`

You delete a record from the database, but it's not completely erased from the file. The record becomes unusable.

## Why use `tissue-roll`?

JavaScript has numerous fantastic database libraries available, but at times, they can seem overly complex.  
This particular solution is ideal for situations where you need to store data for an extended period, making it well-suited for less critical data that doesn't require a rigid structure. Or when it's annoying.

### Q. How does it differ from a `Map` object?

The `Map` object is memory-based, while `tissue-roll` is file-based.

### Q. Why should I use this instead of `JSON`?

When the `JSON` files get large, quick data read and write operations can become challenging.  
`tissue-roll` handles data input and output in real-time, ensuring fast and lightweight performance.

### Q. How does `tissue-roll` work?

`tissue-roll` manages files by breaking them into blocks called pages. You can set the page size when creating the database.

When you insert data, the ID you get back includes information about where the data is stored on the page. This makes it possible to work with large files quickly.

## Performance Test

The test result is the average value from 10 attempts.  
If you're adding data to the database in real-time, the results would be as follows:

|`WRITE`|JSON|tissue-roll|`RESULT`|
|---|---|---|---|
|1 times|3ms|8ms|`-266% Slower`|
|100 times|111ms|67ms|`165% Faster`|
|10,000 times|22,269ms|4,175ms|`533% Faster`|

|`READ`|JSON|tissue-roll|`RESULT`|
|---|---|---|---|
|from 1,000 record|1ms|5ms|`-500% Slower`|
|from 10,000 records|3ms|6ms|`-200% Slower`|
|from 100,000 records|23ms|4ms|`575% Faster`|

This is the usual case, but the results can be different depending on programming optimizations.

## LICENSE

MIT LICENSE
