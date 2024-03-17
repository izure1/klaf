# TissueRoll with Document

This document covers the usage of the **document-oriented** database in **tissue-roll**.

The document database in **tissue-roll** allows you to insert data in **JSON** format. Specify each field in TypeScript.

If this is not the database you were looking for, please check the [key-value](../core/README.md) database.

## Usage

```typescript
import { TissueRollDocument } from 'tissue-roll'

// OPEN DB
const payloadSize = 1024
const db = TissueRollDocument.Open<{
  name: string
  age?: number
}>('my_file_path.db', payloadSize)

db.put({
  name: 'john'
})

db.put({
  name: 'park',
  age: 25
})

db.put({
  name: 'sato',
  age: 10
})

const result = db.pick({
  age: {
    gt: 15
  }
})

console.log(result) // [{ name: 'park', age: 25 }]

db.metadata.autoIncrement // 3
db.metadata.count // 3
```

The **TissueRollDocument** manages files in logical blocks called pages. The payload size determines the size of these blocks, measured in bytes.

If there are many write/update operations in the database, it's recommended to set this value to a smaller size, around the size of one document. However, this may result in a larger overall database file size. On the other hand, if there are many read operations, it's advised to set this value to a larger size, but keep in mind that it might slow down write/update speeds.

*Note that this value cannot be modified after the database is created*, so choose carefully. If you're unsure, you can leave it as the default, which is **1024**.

## How to work

### Explicit Type Specification

If you are using TypeScript, specifying clear types in the database allows you to benefit from type inference.

```typescript
const payloadSize = 1024
const db = const db = TissueRollDocument.Open<{
  student: boolean
  name: string
  age?: number
  sex?: 'male'|'female'
}>('my_file_path.db', payloadSize)
```

In this case, you can indicate that the **age** and **sex** properties may or may not exist during document insertion. For example, it can be inserted as `{ student: false, name: 'park' }` or `{ student: false, name: 'park', age: 20 }`.

**Be cautious**. Note that in specific documents, values like **age** and **sex** that do not exist are not treated as equivalent to **null**. Therefore, you cannot search for them as **null**, as shown in the example below.

```typescript
db.pick({
  age: {
    equal: null
  }
}) // Do not use it like this. It will not yield correct results.
```

If you want to retrieve documents where the **age** property does not exist, you can use the following approach.

```typescript
db.pick({}).filter((doc) => !('age' in doc))
```

However, keep in mind that this might not be performance-efficient as it involves querying all documents. Therefore, if you often need to search by **age**, it is better to initialize the value of the **age** property explicitly to **null**, not as an optional property, for optimization of **age** lookups.

If you want to explicitly initialize this property to **null** in all existing documents, please update the database. The following is a code that queries all documents and initializes the **age** property to **null** if it is not in the document.

```typescript
// Ensure the age property in all documents
db.partialUpdate({}, (document) => ({
  age: document.age ?? null
}))
```

Now, you can quickly search only for documents where the **age** property value is **null**.

```typescript
db.pick({
  age: {
    equal: null
  }
})
```

### Optimization

**TissueRollDocument** inserts data in the form of **JSON** records, which are referred to as documents. A document has a **key-value** relationship, and the values can be of type **string**, **number**, **boolean**, or **null**. It follows the same format as **JSON**, and there is no limit to the depth of the document.

For example, you can insert a document like the following:

```typescript
{
  name: 'pit',
  color: 'gold',
  owner: null,
  more: {
    price: 1000,
    information: {
      sales: [100, 0, 20, 35]
    }
  },
  products: [13223, 1992, 4582]
}
```

When inserting a document, **TissueRollDocument** looks for properties that have primitive types as values. Primitive types include **string**, **number**, **boolean**, and **null**. In the example document, properties like **name**, **color**, and **owner** fall into this category. **TissueRollDocument** attempts to optimize these properties by creating a new B+tree structure.

However, there's an important point to note. The properties **more** and **products** do not have primitive types as values. These properties are not optimized for queries and cannot be used as conditions for the **pick** method.

If you want to use **more.price** as a query condition, you need to make it a top-level property of the document. See the example below:

```typescript
{
  name: 'pit',
  color: 'gold',
  owner: null,
  price: 1000,
  more: {
    price: 1000,
    information: {
      sales: [100, 0, 20, 35]
    }
  },
  products: [13223, 1992, 4582]
}
```

Afterward, you can use the **price** property in the **pick** method to perform queries.

```typescript
const result = db.pick({
  price: {
    gt: 100
  }
})
```

### Search query

When retrieving inserted documents, you can specify queries using the document's properties. Here's an example:

```typescript
const result = db.pick({
  name: {
    equal: 'pit'
  },
  price: {
    gt: 100,
    lt: 3000
  }
})
```

This query retrieves values where the name is **pit** and the **price** is above **100** but below **3000**. The **gt** and **lt** operators, when applied to strings, compare based on Unicode code point values. For boolean values, **false** is treated as **0**, and **true** is treated as **1**. The **null** values are treated as **0** for computation.

For other types, the behavior depends on the result of the **toString()** method. For example, an array like **[0, 1, 2, 3]** will be converted to **0,1,2,3** based on JavaScript's array toString implementation. If an object is encountered, it might result in **[object Object]**. In such cases, proper comparison might not work as expected, so caution is advised.

#### Using Abbreviated Query Statements

If the query conditional is **equal**, you can directly input this value as a property value and use it in a shortened form.

```typescript
const result = db.pick({
  name: {
    equal: 'pit'
  },
  price: {
    gt: 100,
    lt: 3000
  }
})
// The above code works the same as below.
const result = db.pick({
  name: 'pit',
  price: {
    gt: 100,
    lt: 3000
  }
})
```

#### Using the **LIKE** Clause for Search Conditions

Starting from version 3.0.0, **like** search is supported. **Like** search retrieves all documents matching the pattern provided. It behaves similar to regular expressions. **'%'** matches zero or more characters, and **'_'** matches exactly one character. For example, you can use it like this:

```typescript
const result = db.pick({
  name: {
    like: 'p%t'
  }
})
```

This searches for all documents that start with **'p'** and end with **'t'**. If you want to search for all documents starting with **'p'**, you can use it like this:

```typescript
const result = db.pick({
  name: {
    like: 'p%'
  }
})
```

If you want to select only **'pit'** and **'put'** from the values **'pit'**, **'put'**, **'pint'**, and **'post'**, you can use the **'_'** wildcard, which represents a single character, like this:

```typescript
const result = db.pick({
  name: {
    like: 'p_t'
  }
})
```

However, **like** search queries require scanning through all documents in the database. Therefore, indiscriminate use should be avoided as it can have a negative impact on performance.

### Search option

You can use the option parameter in addition to the query when calling the **pick** method. The usage is as follows.

```typescript
const result = db.pick({}, {
  start: 0,
  end: 30,
  order: 'age',
  desc: true
})
```

The **start** and **end** properties are used to retrieve a portion of the array of retrieved documents, similar to the **slice** method in JavaScript arrays.

The default value for **start** is **0**, and the default value for **end** is **Number.MAX_SAFE_INTEGER**.

**order** determines which property to use as the basis for sorting the retrieved documents. The default is **createdAt**, so the documents are sorted in the order they were inserted.

**desc** determines whether to sort the retrieved array in descending order. The default value is **false**. If this value is set to **true**, the array of retrieved documents will be sorted in descending order based on the order property.

### Metadata

You can obtain some information related to the database using the **db.metadata** property. The **metadata.count** property signifies the number of documents currently stored in the database. The **metadata.autoIncrement** property represents the total number of documents that have been inserted into the database so far. This value does not decrease even if documents are deleted.

```typescript
db.put({ name: 'john' })

db.metadata.autoIncrement // 1
db.metadata.count // 1

db.delete({ name: 'john' })

db.metadata.autoIncrement // 1
db.metadata.count // 0
```

## Performance Comparison between **sqlite3** and **TissueRollDocument**

The following values compare the speed with **sqlite3** written in C/C++. These are the average of **5** tests. In data retrieval, **sqlite3** demonstrates speeds approximately **3-5** times faster. **TissueRollDocument** will strive to narrow this gap further.

![COMPARISON](../asset/image/svg_perf_compare.svg)
