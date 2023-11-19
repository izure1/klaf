# TissueRoll with Key-value

This document covers the usage of the `key-value` database in `tissue-roll`.

Unlike typical `key-value` databases, the key is automatically generated upon data insertion and **cannot** be directly specified by the user. Please take note of this distinction.

If this is not the database you were looking for, please check the `document-oriented` database.

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
## API

### Static Functions

#### TissueRoll.Create(file: `string`, payloadSize = `8192`, overwrite = `false`): `TissueRoll`

It creates a new database file.

#### TissueRoll.Open(file: `string`, payloadSize = `8192`): `TissueRoll`

It opens or creates a database file at the specified path. If `payloadSize` parameter value is specified as a positive number and there's no database file at the path, it will create a new one.

### Methods

#### put(data: `string`): `string`

You store data in the database and receive a record ID for the saved data. This ID should be stored separately because it will be used in subsequent update, delete, and pick methods.

#### update(recordId: `string`, data: `string`): `string`

You update an existing record.

If the inserted data is shorter than the previous data, the existing record is updated.
Conversely, if the new data is longer, a new record is created.

These newly created records are called `alias record`, and when you call the `pick` method using the current record ID, the alias record is retrieved.
If an alias record existed previously, the existing alias record is deleted and can no longer be used.

#### delete(recordId: `string`): `void`

You delete a record from the database, but it's not completely erased from the file. The record becomes unusable.

#### pick(recordId: `string`): `RecordInformation`

Get record from database with a id.  
Don't pass an incorrect record ID. This does not ensure the validity of the record. Use the `exists` method to validate the record id.

#### exists(recordId: `string`): `boolean`

It returns whether the record exists in the database. If it has been deleted or has an invalid record ID, it returns `false`.

#### getRecords(index: `number`): `RecordInformation.record`

It takes a page index as a parameter and returns a list of all records recorded on that page.  
The page index should be within the range of `1` to `instance.root.index`.

#### onBefore(command: `'put'`|`'update'`|`'delete'`, callback: (arg: `any`) => `any`): `this`

Register preprocessing functions for hooking before executing database operations such as `put`, `update`, and `delete` commands.  
The value returned by this callback function is what is actually applied to the database.

If multiple pre-processing functions are registered, they run sequentially, with each subsequent pre-processing function receiving the value returned by the previous one as a parameter.

#### onceBefore(command: `'put'`|`'update'`|`'delete'`, callback: (arg: `any`) => `any`): `this`

Same as the `onBefore` method, but only works once. For more information, see the `onBefore` method.

#### onAfter(command: `'put'`|`'update'`|`'delete'`, callback: (arg: `any`) => `any`): `this`

Register post-processing functions for hooking after performing database operations such as `put`, `update`, and `delete` commands.  
You can use the value returned by this callback function for additional operations.

If multiple post-processing functions are registered, they run sequentially, with each subsequent post-processing function receiving the values returned by the previous one as parameters.

#### onceAfter(command: `'put'`|`'update'`|`'delete'`, callback: (arg: `any`) => `any`): `this`

Same as the `onAfter` method, but only works once. For more information, see the `onAfter` method.

#### offBefore(command: `'put'`|`'update'`|`'delete'`, callback: (arg: `any`) => `any`): `this`

You remove the pre-processing functions added with `onBefore` or `onceBefore` methods.  

If there is no callback parameter, it removes all pre-processing functions registered for that command.

#### offAfter(command: `'put'`|`'update'`|`'delete'`, callback: (arg: `any`) => `any`): `this`

You remove the post-processing functions added with `onAfter` or `onceAfter` methods.  

If there is no callback parameter, it removes all post-processing functions registered for that command.