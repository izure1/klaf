import {
  type KlafDocumentable,
  Klaf,
  KlafDocument
} from 'klaf.js'
import { DataEngine } from 'klaf.js/engine/DataEngine'
import { FileSystemEngine } from 'klaf.js/engine/FileSystem'
import { InMemoryEngine } from 'klaf.js/engine/InMemory'

const IN_MEMORY = process.env.npm_config_in_memory === 'true'

interface DocumentDatabaseScheme extends KlafDocumentable {
  name: string
  age: number
  sex: 'male'|'female'
}

const createDatabase = async (name: string) => {
  name = `_${name}`
  let engine: DataEngine = new FileSystemEngine()
  if (IN_MEMORY) {
    engine = new InMemoryEngine()
  }
  const db = await Klaf.Create({
    path: name,
    engine,
    payloadSize: 1024,
    overwrite: true,
  })
  
  const close = async () => {
    await db.close()
    engine._unlink(name)
  }

  return {
    db,
    close,
  }
}

const openDatabase = async (name: string) => {
  name = `_${name}`
  let engine: DataEngine = new FileSystemEngine()
  if (IN_MEMORY) {
    engine = new InMemoryEngine()
  }
  const db = await Klaf.Open({
    path: name,
    engine,
    payloadSize: 1024,
    overwrite: true
  })
  
  const close = async () => {
    await db.close()
    engine._unlink(name)
  }

  return {
    db,
    close,
  }
}

const createDocumentDatabase = async (name: string) => {
  name = `_${name}`
  let engine: DataEngine = new FileSystemEngine()
  if (IN_MEMORY) {
    engine = new InMemoryEngine()
  }

  const sql = await KlafDocument.Create<DocumentDatabaseScheme>({
    path: name,
    engine,
    journal: false,
    version: 0,
    payloadSize: 4096,
    overwrite: true,
    commitDebounce: 1000,
    scheme: {
      name: {
        default: () => '',
        validate: (v) => typeof v === 'string'
      },
      age: {
        default: () => 0,
        validate: (v) => typeof v === 'number'
      },
      sex: {
        default: () => 'male',
        validate: (v) => v === 'male' || v === 'female'
      }
    }
  })

  await sql.batch([
    { name: 'kim', age: 10, sex: 'female' },
    { name: 'tomas', age: 80, sex: 'male' },
    { name: 'john', age: 20, sex: 'male' },
    { name: 'lee', age: 50, sex: 'female' }
  ])
  
  const close = async () => {
    await sql.close()
    engine._unlink(name)
  }

  return {
    sql,
    close,
  }
}

describe('Create test', () => {
  test('db create', async () => {
    const { db, close } = await createDatabase('db-create.db')
    const { index, majorVersion, minorVersion, patchVersion, timestamp } = db.metadata
    expect(typeof index).toBe('number')
    expect(typeof majorVersion).toBe('number')
    expect(typeof minorVersion).toBe('number')
    expect(typeof patchVersion).toBe('number')
    expect(timestamp > Date.now()).toBeFalsy()
    close()
  })

  test('db open', async () => {
    const created = await createDatabase('db-open.db')
    const { index, majorVersion, minorVersion, patchVersion, timestamp } = created.db.metadata
    await created.db.close()

    const opened = await openDatabase('db-open.db')
    expect(typeof index).toBe('number')
    expect(typeof majorVersion).toBe('number')
    expect(typeof minorVersion).toBe('number')
    expect(typeof patchVersion).toBe('number')
    expect(timestamp > Date.now()).toBeFalsy()
    await opened.close()
  })
})

describe('DB', () => {
  test('DB:put record that shorter than page size', async () => {
    const { db, close } = await createDatabase('db-shorter.db')
    const max = 10
    const texts = new Array(max).fill(0).map((t, i) => `:db-put-test-${i}:`)
    const [errBatch, ids] = await db.batch(texts)
    if (errBatch) {
      throw errBatch
    }

    const rand = Math.floor(Math.random()*max)
    const target = ids[rand]
    const guess = `:db-put-test-${rand}:`

    const [err, res] = await db.pick(target)
    expect(err).toBe(undefined)
    expect(res!.record.payload).toBe(guess)
    close()
  })

  test('DB:put record that longer than page size', async () => {
    const { db, close } = await createDatabase('db-longer.db')

    const content = new Array(Math.floor(db.metadata.payloadSize * 1.5)).fill(0).map((t, i) => i).join(',')

    const [err1, id] = await db.put(content)
    await db.put('meaningless dummy data')
    const [err2, res] = await db.pick(id!)
    expect(err1).toBe(undefined)
    expect(err2).toBe(undefined)
    expect(res!.record.payload).toBe(content)

    close()
  })

  test('DB:update', async () => {
    const { db, close } = await createDatabase('db-update.db')

    const content = 'long text'.repeat(100)
    const longerContent = 'more longer text'.repeat(100)
    const longerContent2 = 'more more longer text'.repeat(100)
    const shorterContent = 'shorter token'
    const longerContent3 = 'very more more longer text'.repeat(100)
    const longestContent = 'very more more longest text'.repeat(100)

    const [err, id] = await db.put(content)
    expect(err).toBe(undefined)
    if (err) {
      throw err
    }
    
    const [errUp1] = await db.update(id!, longerContent)
    if (errUp1) {
      throw errUp1
    }
    const [err1, res1] = await db.pick(id!)
    expect(err1).toBe(undefined)
    expect(res1!.record.payload).toBe(longerContent)
    expect(res1!.record.header.maxLength).toBe(longerContent.length)

    const [errUp2] = await db.update(id!, longerContent2)
    if (errUp2) {
      throw errUp2
    }
    const [err2, res2] = await db.pick(id!)
    expect(err2).toBe(undefined)
    expect(res2!.record.payload).toBe(longerContent2)
    
    const [errUp3] = await db.update(id!, shorterContent)
    if (errUp3) {
      throw errUp3
    }
    const [err3, res3] = await db.pick(id!)
    expect(err3).toBe(undefined)
    expect(res3!.record.payload).toBe(shorterContent)
    
    const [errUp4] = await db.update(id!, longerContent3)
    if (errUp4) {
      throw errUp4
    }
    const [err4, res4] = await db.pick(id!)
    expect(err4).toBe(undefined)
    expect(res4!.record.payload).toBe(longerContent3)

    const [errUp5] = await db.update(id!, longestContent)
    if (errUp5) {
      throw errUp5
    }
    const [err5, res5] = await db.pick(id!)
    expect(err5).toBe(undefined)
    expect(res5!.record.payload).toBe(longestContent)

    close()
  })

  test('DB:delete', async () => {
    const { db, close } = await createDatabase('db-delete.db')

    const content = 'you should can not read this'

    const [err, id] = await db.put(content)
    expect(err).toBe(undefined)
    await db.delete(id!)
    const [pickError] = await db.pick(id!)
    const [updateError] = await db.update(id!, 'error')
    expect(pickError).toBeInstanceOf(Error)
    expect(updateError).toBeInstanceOf(Error)

    const [err2, id2] = await db.put('test content')
    const [deleteError] = await db.delete('incorrect id')
    expect(err2).toBe(undefined)
    expect(deleteError).toBeInstanceOf(Error)
    await db.delete(id2!)
    close()
  })

  test('DB:invalid record', async () => {
    const { db, close } = await createDatabase('db-invalid-record.db')

    const invalidId = btoa('1928399199299331123')
    const [pickError] = await db.pick(invalidId)
    const [updateError] = await db.update(invalidId, 'test')
    const [deleteError] = await db.delete(invalidId)
    expect(pickError).toBeInstanceOf(Error)
    expect(updateError).toBeInstanceOf(Error)
    expect(deleteError).toBeInstanceOf(Error)
    close()
  })

  test('DB:exists', async () => {
    const { db, close } = await createDatabase('db-exists.db')

    const [err, correctId] = await db.put('test')
    const invalidId = correctId+'1'

    const [notErr, existing] = await db.exists(correctId!)
    const [foundError, notExisting] = await db.exists(invalidId)

    expect(err).toBe(undefined)
    expect(notErr).toBe(undefined)
    expect(foundError).toBe(undefined)
    expect(existing).toBe(true)
    expect(notExisting).toBe(false)
    close()
  })

  test('DB:getRecords', async () => {
    const { db, close } = await createDatabase('db-get-records.db')

    const largeData = ' '.repeat(10000)
    await db.put(largeData)

    const guessData1 = 'a'
    const guessData2 = 'b'
    const guessData3 = 'c'

    const [err1, id] = await db.put(guessData1)
    expect(err1).toBe(undefined)

    await db.put(guessData2)
    await db.put(guessData3)

    const [err2, record] = await db.pick(id!)
    expect(err2).toBe(undefined)
    const [err, records] = await db.getRecords(record!.page.index)

    expect(err).toBe(undefined)
    expect(records![0].payload).toBe(guessData1)
    expect(records![1].payload).toBe(guessData2)
    expect(records![2].payload).toBe(guessData3)
    close()
  })

  test('DB:autoIncrement', async () => {
    const { db, close } = await createDatabase('db-auto-increment.db')

    const [err, sampleId] = await db.put('a')
    expect(err).toBe(undefined)

    await db.put('b')
    await db.put('c')
    await db.put('longer'.repeat(1000))
    await db.put('e')
    expect(Number((db.metadata).autoIncrement)).toBe(5)

    await db.update(sampleId!, 'more longer')
    expect(Number((db.metadata).autoIncrement)).toBe(5)

    await db.delete(sampleId!)
    expect(Number((db.metadata).autoIncrement)).toBe(5)

    close()
  })

  test('DB:count', async () => {
    const { db, close } = await createDatabase('db-count.db')

    const [err, sampleId] = await db.put('a')
    expect(err).toBe(undefined)

    await db.put('b')
    await db.put('c')
    await db.put('longer'.repeat(1000))
    await db.put('e')
    expect(Number((db.metadata).count)).toBe(5)

    await db.update(sampleId!, 'more longer')
    expect(Number((db.metadata).count)).toBe(5)

    await db.delete(sampleId!)
    expect(Number((db.metadata).count)).toBe(4)

    close()
  })

  test('DB:close lock', async () => {
    const { db, close } = await createDatabase('db-close-lock.db')

    const [err, recordId] = await db.put('a')
    await close()

    const [putError] = await db.put('a')
    const [pickError] = await db.pick(recordId!)
    const [deleteError] = await db.delete(recordId!)
    
    expect(err).toBe(undefined)
    expect(putError).not.toBe(undefined)
    expect(pickError).not.toBe(undefined)
    expect(deleteError).not.toBe(undefined)
  })
})

describe('DOCUMENT', () => {
  test('DOCUMENT:put', async () => {
    const { sql, close } = await createDocumentDatabase('doc-put.db')

    const [err1, result1] = await sql.pick({
      age: {
        gt: 15
      }
    })
    if (err1) throw err1
    const expect1 = [
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'john', age: 20, sex: 'male' },
      { name: 'lee', age: 50, sex: 'female' },
    ]
    result1!.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })

    const [err2, result2] = await sql.pick({
      name: {
        notEqual: 'lee'
      },
      age: {
        gt: 15,
        lt: 75
      }
    })
    if (err2) throw err2
    const expect2 = [
      { name: 'john', age: 20, sex: 'male' },
    ]
    result2!.forEach((record, i) => {
      expect(record).toMatchObject(expect2[i])
    })

    expect(err1).toBe(undefined)
    expect(err2).toBe(undefined)
    close()
  })

  test('DOCUMENT:delete', async () => {
    const { sql, close } = await createDocumentDatabase('doc-delete.db') 

    const [err1, delCount] = await sql.delete({
      name: {
        equal: 'tomas'
      }
    })
    if (err1) throw err1

    expect(delCount).toBe(1)

    const [err2, result1] = await sql.pick({})
    if (err2) throw err2

    const expect1 = [
      { name: 'kim', age: 10 },
      { name: 'john', age: 20, sex: 'male' },
      { name: 'lee', age: 50, sex: 'female' },
    ]
    result1!.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })

    await sql.delete({})

    const [err3, result2] = await sql.pick({})
    if (err3) throw err3
    expect(result2).toEqual([])

    expect(err1).toBe(undefined)
    expect(err2).toBe(undefined)
    expect(err3).toBe(undefined)

    close()
  })

  test('DOCUMENT:update:partial', async () => {
    const { sql, close } = await createDocumentDatabase('doc-update-partial.db')

    const [err, updatedCount] = await sql.partialUpdate({
      name: {
        equal: 'kim'
      }
    }, {
      age: 22,
      sex: 'female'
    })
    if (err) throw err

    const [err1, result1] = await sql.pick({
      name: {
        equal: 'kim'
      }
    })
    if (err1) throw err1

    const expect1 = [
      { name: 'kim', age: 22, sex: 'female' }
    ]
    result1!.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })

    expect(err).toBe(undefined)
    expect(err1).toBe(undefined)
    expect(updatedCount).toBe(1)

    close()
  })

  test('DOCUMENT:update:full-1', async () => {
    const { sql, close } = await createDocumentDatabase('doc-update-full-1.db')

    const [err, updatedCount] = await sql.fullUpdate({
      age: {
        gt: 15,
        lt: 75
      }
    }, { name: 'unknown', age: 0, sex: 'male' })
    if (err) throw err

    const [err1, result1] = await sql.pick({})
    if (err1) throw err1
    const expect1 = [
      { name: 'kim', age: 10 },
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'unknown', age: 0, sex: 'male' },
      { name: 'unknown', age: 0, sex: 'male' },
    ]
    result1!.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })

    expect(err).toBe(undefined)
    expect(err1).toBe(undefined)
    expect(updatedCount).toBe(2)

    close()
  })

  test('DOCUMENT:update:full-2', async () => {
    const { sql, close } = await createDocumentDatabase('doc-update-full-2.db')

    const [err, updatedCount] = await sql.fullUpdate({
      age: {
        gt: 15,
        lt: 75
      }
    }, (record) => ({
      name: record.name,
      age: 0,
      sex: record.sex
    }))
    if (err) throw err

    const [err1, result1] = await sql.pick({})
    if (err1) throw err1
    const expect1 = [
      { name: 'kim', age: 10 },
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'john', age: 0, sex: 'male' },
      { name: 'lee', age: 0, sex: 'female' },
    ]
    result1!.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })

    expect(err).toBe(undefined)
    expect(err1).toBe(undefined)
    expect(updatedCount).toBe(2)

    close()
  })

  test('DOCUMENT:pick:query', async () => {
    const { sql, close } = await createDocumentDatabase('doc-pick-query.db')

    const [err1, result1] = await sql.pick({
      name: 'kim'
    })
    if (err1) throw err1
    const expect1 = [
      { name: 'kim', age: 10 }
    ]
    result1!.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })

    const [err2, result2] = await sql.pick({
      name: 'kim',
      age: 10
    })
    if (err2) throw err2
    const expect2 = [
      { name: 'kim', age: 10 }
    ]
    result2!.forEach((record, i) => {
      expect(record).toMatchObject(expect2[i])
    })

    const [err3, result3] = await sql.pick({
      name: 'kim',
      age: 11
    })
    if (err3) throw err3
    expect(result3).toEqual([])

    expect(err1).toBe(undefined)
    expect(err2).toBe(undefined)
    expect(err3).toBe(undefined)

    close()
  })

  test('DOCUMENT:pick:range-1', async () => {
    const { sql, close } = await createDocumentDatabase('doc-pick-range-1.db')

    const [err1, result1] = await sql.pick({
      age: {
        gt: 15
      }
    }, {
      order: 'age',
      desc: true
    })
    if (err1) throw err1
    const expect1 = [
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'lee', age: 50, sex: 'female' },
      { name: 'john', age: 20, sex: 'male' },
    ]
    result1!.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })

    const [err2, result2] = await sql.pick({}, {
      order: 'sex',
    })
    if (err2) throw err2
    const expect2 = [
      { name: 'kim', age: 10, sex: 'female' },
      { name: 'lee', age: 50, sex: 'female' },
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'john', age: 20, sex: 'male' },
    ]
    result2!.forEach((record, i) => {
      expect(record).toMatchObject(expect2[i])
    })

    const [err3, result3] = await sql.pick({
      name: {
        like: 'l%'
      }
    })
    if (err3) throw err3
    const expect3 = [
      { name: 'lee', age: 50, sex: 'female' },
    ]
    result3!.forEach((record, i) => {
      expect(record).toMatchObject(expect3[i])
    })

    const [err4, result4] = await sql.pick({
      name: {
        like: '%o%'
      }
    })
    if (err4) throw err4
    const expect4 = [
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'john', age: 20, sex: 'male' },
    ]
    result4!.forEach((record, i) => {
      expect(record).toMatchObject(expect4[i])
    })

    const [err5, result5] = await sql.pick({
      name: {
        or: ['john', 'kim']
      }
    })
    if (err5) throw err5
    const expect5 = [
      { name: 'kim', age: 10, sex: 'female' },
      { name: 'john', age: 20, sex: 'male' },
    ]
    result5!.forEach((record, i) => {
      expect(record).toMatchObject(expect5[i])
    })

    expect(err1).toBe(undefined)
    expect(err2).toBe(undefined)
    expect(err3).toBe(undefined)
    expect(err4).toBe(undefined)
    expect(err5).toBe(undefined)

    close()
  })

  test('DOCUMENT:pick:range-2', async () => {
    const { sql, close } = await createDocumentDatabase('doc-pick-range-2.db')

    const batches: DocumentDatabaseScheme[] = []
    for (let i = 0; i < 100; i++) {
      batches.push({ name: 'unknown', age: i, sex: 'male' })
    }
    await sql.batch(batches)

    const [err1, result1] = await sql.pick({
      name: {
        equal: 'unknown'
      },
      age: {
        gt: 30
      }
    }, {
      start: 0,
      end: 10,
      order: 'age'
    })
    if (err1) throw err1
    const expect1 = new Array(10).fill(0).map((v, i) => ({ name: 'unknown', age: 31+i }))
    result1!.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })

    expect(err1).toBe(undefined)

    close()
  })

  test('DOCUMENT:autoIncrement', async () => {
    const { sql, close } = await createDocumentDatabase('doc-auto-increment.db')
    expect((sql.metadata).autoIncrement).toBe(4n)

    await sql.partialUpdate({ name: 'kim' }, { name: 'kim'.repeat(10000) })
    expect((sql.metadata).autoIncrement).toBe(4n)

    await sql.delete({ name: 'kim' })
    expect((sql.metadata).autoIncrement).toBe(4n)

    close()
  })

  test('DOCUMENT:count', async () => {
    const { sql, close } = await createDocumentDatabase('doc-count-1.db')
    expect((sql.metadata).count).toBe(4)

    await sql.partialUpdate({ name: 'kim' }, { name: 'kim'.repeat(10000) })
    expect((sql.metadata).count).toBe(4)

    await sql.delete({ name: 'kim' })
    expect((sql.metadata).count).toBe(4)

    await sql.delete({ sex: 'male' })
    expect((sql.metadata).count).toBe(2)

    close()
  })

  test('DOCUMENT:count method', async () => {
    const { sql, close } = await createDocumentDatabase('doc-count-2.db')
    const [err1, count1] = await sql.count({
      age: {
        gt: 10
      }
    })
    if (err1) throw err1
    expect(count1).toBe(3)

    await sql.delete({ sex: 'male' })
    const [err2, count2] = await sql.count({
      age: {
        gt: 10
      }
    })
    if (err2) throw err2
    expect(count2).toBe(1)
    
    await sql.partialUpdate({
      age: {
        lt: 15
      }
    }, { age: 15 })

    const [err3, count3] = await sql.count({
      age: {
        gt: 10
      }
    })
    if (err3) throw err3
    expect(count3).toBe(2)

    expect(err1).toBe(undefined)
    expect(err2).toBe(undefined)
    expect(err3).toBe(undefined)
    
    close()
  })

  test('DOCUMENT:close lock', async () => {
    const { sql, close } = await createDocumentDatabase('doc-close-lock.db')

    await sql.put({ age: 1 })
    await close()

    const [putError] = await sql.put({ age: 1 })
    const [pickError] = await sql.pick({})
    const [deleteError] = await sql.delete({ age: 1 })

    expect(putError).not.toBe(undefined)
    expect(pickError).not.toBe(undefined)
    expect(deleteError).not.toBe(undefined)
  })
})
