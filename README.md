# Klaf

![node.js workflow](https://github.com/izure1/klaf/actions/workflows/node.js.yml/badge.svg)

<p align="center">
  <img src="./docs/asset/image/logo_klaf.svg">
</p>

Very simple read/write database with a **NoSQL**.  
It's written in JavaScript using pure Node.js API and pretty easy and small.

**klaf** comes in two flavors: **key-value** database and **document-oriented** database.  
You have the freedom to choose based on your needs, **but most users will likely prefer the *document-oriented* database.**

For details on how to use each database, please refer to the links below.

* [**Document-oriented Database**](./docs/document/README.md)
* [**Key-value Database**](./docs/core/README.md)

## Install

```bash
npm i klaf.js
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

**klaf** manages files by breaking them into blocks called pages. You can set the page size when creating the database.

When you insert data, the ID you get back includes information about where the data is stored on the page. This makes it possible to work with large files quickly. This value could be seen by users, but it's encrypted to make it hard to predict. This way, it stops users from trying to steal data by requesting fake record IDs.

### How many can I own data?

**klaf** can make a unsigned 32bit range of page block. This is a **4,294,967,296**. And each page can own unsigned 32bit range of records also. So you can theoretically insert **4,294,967,295** * **4,294,967,295** records.

## Migration

The Klaf library is the new name for the TissueRoll library. Klaf 1.x.x corresponds to TissueRoll 6.x.x. Therefore, this migration document is intended for users of TissueRoll 5.x.x.

For migration to version 1.x, please refer to [this link](./docs/migration/6.md).

## Performance Test

The test result is the average value from 10 attempts.

**klaf** supports two databases, and this test tested the core functions of data reading/writing of the two databases. Therefore, it's not a perfect test result, but it's enough to show the time complexity.

If you're adding data to the database in real-time, the results would be as follows:

### WRITE

For a little data, JSON is faster, but when you've got a big file, it's the other way around, and the gap gets bigger.

|`WRITE`|JSON|KLAF|`RESULT`|
|---|---|---|---|
|1,000 times|1014ms|1990ms|*-49% Slower*|
|2,000 times|2200ms|3800ms|*-42% Slower*|
|4,000 times|5674ms|7509ms|*-24% Slower*|
|8,000 times|15332ms|14788ms|***+4% Faster***|
|16,000 times|46617ms|29755ms|***+57% Faster***|

### READ

**klaf** maintains a steady reading speed no matter the database size. In contrast, JSON files slow down as they get bigger.

|`READ`|JSON|KLAF|`RESULT`|
|---|---|---|---|
|from 8,000 records|1.8ms|5.6ms|*-68% Slower*|
|from 16,000 records|4ms|2ms|***+100% Faster***|
|from 32,000 records|5.4ms|2.2ms|***+145% Faster***|
|from 64,000 records|11.4ms|2ms|***+470% Faster***|
|from 128,000 records|26.4ms|2.6ms|***+915% Faster***|

### RESULT

![WRITE](./docs/asset/image/svg_perf_write.svg)
![READ](./docs/asset/image/svg_perf_read.svg)

**NOTICE!**

*This is the usual case, but the results can be different depending on programming optimizations. Please note that this test takes a square of the sample size to easily show the error with a small number of tests. Therefore, the graph appears to increase exponentially, but in terms of time complexity, JSON has **O(n)**, and klaf has a speed of **O(1)**.*

## Install

|Site|Link|
|---|---|
|**NPM**|[View](https://www.npmjs.com/package/klaf.js)|
|**Github**|[View](https://github.com/izure1/klaf)|

## License

MIT LICENSE
