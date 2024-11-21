import { unlinkSync } from 'node:fs'
import { Klaf, KlafDocument } from 'klaf.js'
import { DataEngine } from 'klaf.js/engine/DataEngine'
import { FileSystemEngine } from 'klaf.js/engine/FileSystem'
import { InMemoryEngine } from 'klaf.js/engine/InMemory'

const IN_MEMORY = process.env.npm_config_in_memory === 'true'

const createDatabase = async (name: string) => {
  let engine: DataEngine = new FileSystemEngine()
  if (IN_MEMORY) {
    engine = new InMemoryEngine()
  }
  const db = await Klaf.Create({
    path: name,
    engine,
    payloadSize: 1024,
    overwrite: true
  })
  
  const close = async () => {
    await db.close()
    if (engine instanceof FileSystemEngine) {
      unlinkSync(name)
    }
  }

  return {
    db,
    close
  }
}

const createDocumentDatabase = async (name: string) => {
  let engine: DataEngine = new FileSystemEngine()
  if (IN_MEMORY) {
    engine = new InMemoryEngine()
  }

  const sql = await KlafDocument.Create({
    path: name,
    engine,
    version: 0,
    payloadSize: 1024,
    overwrite: true,
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
        default: (): 'male'|'female' => 'male',
        validate: (v) => v === 'male' || v === 'female'
      }
    }
  })
  
  await sql.put({ name: 'kim', age: 10, sex: 'female' })
  await sql.put({ name: 'tomas', age: 80, sex: 'male' })
  await sql.put({ name: 'john', age: 20, sex: 'male' })
  await sql.put({ name: 'lee', age: 50, sex: 'female' })
  
  const close = async () => {
    await sql.close()
    if (engine instanceof FileSystemEngine) {
      unlinkSync(name)
    }
  }

  return {
    sql,
    close
  }
}

describe('Create test', () => {
  test('db open', async () => {
    const { db, close } = await createDatabase('db-open.db')
    const { index, majorVersion, minorVersion, patchVersion, timestamp } = db.metadata
    expect(typeof index).toBe('number')
    expect(typeof majorVersion).toBe('number')
    expect(typeof minorVersion).toBe('number')
    expect(typeof patchVersion).toBe('number')
    expect(timestamp > Date.now()).toBeFalsy()
    await close()
  })
})

describe('DB', () => {
  test('DB:put record that shorter than page size', async () => {
    const { db, close } = await createDatabase('db-shorter.db')
    const max = 10
    const ids: string[] = []
    for (let i = 0; i < max; i++) {
      const content = `:db-put-test-${i}:`
      const id = await db.put(content)
      ids.push(id)
    }

    const rand = Math.floor(Math.random()*max)
    const target = ids[rand]
    const guess = `:db-put-test-${rand}:`

    const res = await db.pick(target)
    expect(res.record.payload).toBe(guess)
    await close()
  })

  test('DB:put record that longer than page size', async () => {
    const { db, close } = await createDatabase('db-longer.db')

    const content = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer eros augue, commodo sed laoreet id, euismod id turpis. Vivamus id euismod sapien, vel venenatis turpis. Aliquam at ante odio. Curabitur quis nunc orci. Morbi nibh turpis, placerat quis gravida vestibulum, sollicitudin vel nunc. Curabitur in augue sit amet nibh consectetur posuere. Aliquam erat volutpat. Phasellus nec turpis augue. Cras ut eros nibh. Aenean elementum scelerisque maximus. Cras id nulla at felis molestie suscipit eu ac erat. Nulla tincidunt ornare nulla. Etiam vitae est sed arcu congue dignissim. Nam at odio eget velit hendrerit tincidunt. Sed posuere porttitor volutpat.

    Praesent molestie feugiat lectus, sed molestie odio pulvinar a. Sed vitae ullamcorper dui, sit amet lobortis ipsum. Curabitur orci risus, mattis eget elit a, ornare egestas justo. Morbi vitae convallis ex. Nulla id nisi ultricies, rutrum nulla nec, consequat velit. Maecenas eleifend quis felis in fringilla. In nec risus dapibus, bibendum nunc quis, commodo ex. Donec urna quam, pharetra eu nisl vel, vestibulum feugiat sem. Fusce sodales, odio a aliquet vestibulum, nisi nulla interdum nisi, nec aliquam est tortor quis metus. Sed eu metus venenatis, fringilla lacus a, pharetra lectus.
    
    Phasellus dolor massa, lacinia in massa id, vestibulum bibendum sem. Vestibulum a tortor pulvinar, bibendum nibh sed, interdum lacus. Etiam ut urna et sapien egestas eleifend id quis turpis. Ut condimentum sollicitudin augue, sit amet imperdiet lectus pulvinar ut. Proin sagittis vel orci eu porttitor. Nam luctus non ante non volutpat. Sed nec sem at erat consectetur placerat. Curabitur lacinia maximus commodo. Vivamus nec condimentum mauris, eu commodo arcu. Suspendisse potenti. Aliquam quis tristique nibh. Quisque vulputate ex id urna laoreet gravida.
    
    Fusce interdum magna et euismod luctus. Proin ullamcorper dictum imperdiet. Cras sodales congue tempus. Donec eu sapien quis velit elementum lacinia. Donec scelerisque blandit tortor vel hendrerit. Nulla quis turpis vitae sem vehicula pretium. Sed lacinia, nulla vitae mollis luctus, odio felis volutpat enim, sed dictum dolor neque sit amet mauris. Praesent et sem ullamcorper, dictum leo sit amet, ullamcorper dolor. Nullam auctor arcu ipsum, sit amet consectetur massa finibus vitae. Aenean vehicula, dui in blandit semper, dui lorem tincidunt ex, nec semper est ante vel nulla. Ut condimentum lobortis convallis. Nullam a rutrum velit, eget suscipit elit.
    
    Etiam molestie purus imperdiet nisi dignissim, id fermentum turpis laoreet. Sed ut nibh lacinia, maximus massa non, convallis mi. In id diam blandit, pulvinar nisl a, maximus diam. Etiam dignissim euismod libero eget congue. Vivamus iaculis pulvinar odio ac maximus. Pellentesque ac placerat nulla. Aliquam erat volutpat. Nam eget enim eget est varius commodo. Suspendisse efficitur ante vel rutrum suscipit. Morbi pulvinar lobortis elit, quis efficitur lectus dapibus ac. Mauris leo tellus, mattis et ornare pharetra, facilisis nec lectus. Aenean sed ornare felis. Aenean vestibulum accumsan tortor vel ullamcorper. Maecenas eleifend enim libero, at convallis sem ullamcorper eget.`

    const id = await db.put(content)

    await db.put('meaningless dummy data')

    const res = await db.pick(id)
    expect(res.record.payload).toBe(content)

    await close()
  })

  test('DB:update', async () => {
    const { db, close } = await createDatabase('db-update.db')

    const content = 'long text'.repeat(100)
    const longerContent = 'more longer text'.repeat(100)
    const longerContent2 = 'more more longer text'.repeat(100)
    const shorterContent = 'shorter token'
    const longerContent3 = 'very more more longer text'.repeat(100)
    const longestContent = 'very more more longest text'.repeat(100)

    const id = await db.put(content)
    
    await db.update(id, longerContent)
    const res1 = await db.pick(id)
    expect(res1.record.payload).toBe(longerContent)
    expect(res1.record.header.maxLength).toBe(longerContent.length)

    await db.update(id, longerContent2)
    const res2 = await db.pick(id)
    expect(res2.record.payload).toBe(longerContent2)
    
    await db.update(id, shorterContent)
    const res3 = await db.pick(id)
    expect(res3.record.payload).toBe(shorterContent)
    
    await db.update(id, longerContent3)
    const res4 = await db.pick(id)
    expect(res4.record.payload).toBe(longerContent3)

    await db.update(id, longestContent)
    const res5 = await db.pick(id)
    expect(res5.record.payload).toBe(longestContent)

    await close()
  })

  test('DB:delete', async () => {
    const { db, close } = await createDatabase('db-delete.db')

    const content = 'you should can not read this'

    const id = await db.put(content)
    await db.delete(id)
    await expect(db.pick(id)).rejects.toThrow()
    await expect(db.update(id, 'error')).rejects.toThrow()

    const id2 = await db.put('test content')
    await expect(db.delete('incorrected id')).rejects.toThrow()
    await db.delete(id2)
    await close()
  })

  test('DB:invalid record', async () => {
    const { db, close } = await createDatabase('db-invalid-record.db')

    const invalidId = btoa('1928399199299331123')
    await expect(db.pick(invalidId)).rejects.toThrow()
    await expect(db.update(invalidId, 'test')).rejects.toThrow()
    await expect(db.delete(invalidId)).rejects.toThrow()
    await close()
  })

  test('DB:exists', async () => {
    const { db, close } = await createDatabase('db-exists.db')

    const correctId = await db.put('test')
    const invalidId = correctId+'1'

    expect(await db.exists(correctId)).toBe(true)
    expect(await db.exists(invalidId)).toBe(false)
    await close()
  })

  test('DB:getRecords', async () => {
    const { db, close } = await createDatabase('db-get-records.db')

    const largeData = ' '.repeat(10000)
    await db.put(largeData)

    const guessData1 = 'a'
    const guessData2 = 'b'
    const guessData3 = 'c'

    const id = await db.put(guessData1)
    await db.put(guessData2)
    await db.put(guessData3)

    const record = await db.pick(id)
    const records = await db.getRecords(record.page.index)

    expect(records[0].payload).toBe(guessData1)
    expect(records[1].payload).toBe(guessData2)
    expect(records[2].payload).toBe(guessData3)
    await close()
  })

  test('DB:autoIncrement', async () => {
    const { db, close } = await createDatabase('db-auto-increment.db')

    const sampleId = await db.put('a')
    await db.put('b')
    await db.put('c')
    await db.put('longer'.repeat(1000))
    await db.put('e')
    expect(Number((db.metadata).autoIncrement)).toBe(5)

    await db.update(sampleId, 'more longer')
    expect(Number((db.metadata).autoIncrement)).toBe(5)

    await db.delete(sampleId)
    expect(Number((db.metadata).autoIncrement)).toBe(5)

    await close()
  })

  test('DB:count', async () => {
    const { db, close } = await createDatabase('db-count.db')

    const sampleId = await db.put('a')
    await db.put('b')
    await db.put('c')
    await db.put('longer'.repeat(1000))
    await db.put('e')
    expect(Number((db.metadata).count)).toBe(5)

    await db.update(sampleId, 'more longer')
    expect(Number((db.metadata).count)).toBe(5)

    await db.delete(sampleId)
    expect(Number((db.metadata).count)).toBe(4)

    await close()
  })

  test('DB:close lock', async () => {
    const { db, close } = await createDatabase('db-close-lock.db')

    const recordId = await db.put('a')
    close()
    await expect(db.put('a')).rejects.toThrow()
    await expect(db.pick(recordId)).rejects.toThrow()
    await expect(db.delete(recordId)).rejects.toThrow()
  })
})

describe('DOCUMENT', () => {
  test('DOCUMENT:put', async () => {
    const { sql, close } = await createDocumentDatabase('doc-put.db')

    const result1 = await sql.pick({
      age: {
        gt: 15
      }
    })
    const expect1 = [
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'john', age: 20, sex: 'male' },
      { name: 'lee', age: 50, sex: 'female' },
    ]
    result1.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })

    const result2 = await sql.pick({
      name: {
        notEqual: 'lee'
      },
      age: {
        gt: 15,
        lt: 75
      }
    })
    const expect2 = [
      { name: 'john', age: 20, sex: 'male' },
    ]
    result2.forEach((record, i) => {
      expect(record).toMatchObject(expect2[i])
    })

    await close()
  })

  test('DOCUMENT:delete', async () => {
    const { sql, close } = await createDocumentDatabase('doc-delete.db') 

    const delCount = await sql.delete({
      name: {
        equal: 'tomas'
      }
    })
    const result1 = await sql.pick({})
    const expect1 = [
      { name: 'kim', age: 10 },
      { name: 'john', age: 20, sex: 'male' },
      { name: 'lee', age: 50, sex: 'female' },
    ]
    result1.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })

    await sql.delete({})
    expect(delCount).toBe(1)
    expect(await sql.pick({})).toEqual([])

    await close()
  })

  test('DOCUMENT:update:partial', async () => {
    const { sql, close } = await createDocumentDatabase('doc-update-partial.db')

    const updatedCount = await sql.partialUpdate({
      name: {
        equal: 'kim'
      }
    }, {
      age: 22,
      sex: 'female'
    })

    const result1 = await sql.pick({
      name: {
        equal: 'kim'
      }
    })
    const expect1 = [
      { name: 'kim', age: 22, sex: 'female' }
    ]
    result1.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })
    expect(updatedCount).toBe(1)

    await close()
  })

  test('DOCUMENT:update:full-1', async () => {
    const { sql, close } = await createDocumentDatabase('doc-update-full-1.db')

    const updatedCount = await sql.fullUpdate({
      age: {
        gt: 15,
        lt: 75
      }
    }, { name: 'unknown', age: 0, sex: 'male' })

    const result1 = await sql.pick({})
    const expect1 = [
      { name: 'kim', age: 10 },
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'unknown', age: 0, sex: 'male' },
      { name: 'unknown', age: 0, sex: 'male' },
    ]
    result1.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })
    expect(updatedCount).toBe(2)

    await close()
  })

  test('DOCUMENT:update:full-2', async () => {
    const { sql, close } = await createDocumentDatabase('doc-update-full-2.db')

    const updatedCount = await sql.fullUpdate({
      age: {
        gt: 15,
        lt: 75
      }
    }, (record) => ({
      name: record.name,
      age: 0,
      sex: record.sex
    }))

    const result1 = await sql.pick({})
    const expect1 = [
      { name: 'kim', age: 10 },
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'john', age: 0, sex: 'male' },
      { name: 'lee', age: 0, sex: 'female' },
    ]
    result1.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })
    expect(updatedCount).toBe(2)

    await close()
  })

  test('DOCUMENT:pick:query', async () => {
    const { sql, close } = await createDocumentDatabase('doc-pick-query.db')

    const result1 = await sql.pick({
      name: 'kim'
    })
    const expect1 = [
      { name: 'kim', age: 10 }
    ]
    result1.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })

    const result2 = await sql.pick({
      name: 'kim',
      age: 10
    })
    const expect2 = [
      { name: 'kim', age: 10 }
    ]
    result2.forEach((record, i) => {
      expect(record).toMatchObject(expect2[i])
    })

    const result3 = await sql.pick({
      name: 'kim',
      age: 11
    })
    expect(result3).toEqual([])

    await close()
  })

  test('DOCUMENT:pick:range-1', async () => {
    const { sql, close } = await createDocumentDatabase('doc-pick-range-1.db')

    const result1 = await sql.pick({
      age: {
        gt: 15
      }
    }, {
      order: 'age',
      desc: true
    })
    const expect1 = [
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'lee', age: 50, sex: 'female' },
      { name: 'john', age: 20, sex: 'male' },
    ]
    result1.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })

    const result2 = await sql.pick({}, {
      order: 'sex',
    })
    const expect2 = [
      { name: 'kim', age: 10, sex: 'female' },
      { name: 'lee', age: 50, sex: 'female' },
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'john', age: 20, sex: 'male' },
    ]
    result2.forEach((record, i) => {
      expect(record).toMatchObject(expect2[i])
    })

    const result3 = await sql.pick({
      name: {
        like: 'l%'
      }
    })
    const expect3 = [
      { name: 'lee', age: 50, sex: 'female' },
    ]
    result3.forEach((record, i) => {
      expect(record).toMatchObject(expect3[i])
    })

    const result4 = await sql.pick({
      name: {
        like: '%o%'
      }
    })
    const expect4 = [
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'john', age: 20, sex: 'male' },
    ]
    result4.forEach((record, i) => {
      expect(record).toMatchObject(expect4[i])
    })

    await close()
  })

  test('DOCUMENT:pick:range-2', async () => {
    const { sql, close } = await createDocumentDatabase('doc-pick-range-2.db')

    for (let i = 0; i < 100; i++) {
      await sql.put({ name: 'unknown', age: i, sex: 'male' })
    }

    const result1 = await sql.pick({
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
    const expect1 = new Array(10).fill(0).map((v, i) => ({ name: 'unknown', age: 31+i }))
    result1.forEach((record, i) => {
      expect(record).toMatchObject(expect1[i])
    })

    await close()
  })

  test('DOCUMENT:autoIncrement', async () => {
    const { sql, close } = await createDocumentDatabase('doc-auto-increment.db')
    expect((sql.metadata).autoIncrement).toBe(4n)

    await sql.partialUpdate({ name: 'kim' }, { name: 'kim'.repeat(10000) })
    expect((sql.metadata).autoIncrement).toBe(4n)

    await sql.delete({ name: 'kim' })
    expect((sql.metadata).autoIncrement).toBe(4n)

    await close()
  })

  test('DOCUMENT:count', async () => {
    const { sql, close } = await createDocumentDatabase('doc-count.db')
    expect((sql.metadata).count).toBe(4)

    await sql.partialUpdate({ name: 'kim' }, { name: 'kim'.repeat(10000) })
    expect((sql.metadata).count).toBe(4)

    await sql.delete({ name: 'kim' })
    expect((sql.metadata).count).toBe(4)

    await sql.delete({ sex: 'male' })
    expect((sql.metadata).count).toBe(2)

    await close()
  })

  test('DOCUMENT:count method', async () => {
    const { sql, close } = await createDocumentDatabase('doc-count.db')
    expect(await sql.count({
      age: {
        gt: 10
      }
    })).toBe(3)

    await sql.delete({ sex: 'male' })
    expect(await sql.count({
      age: {
        gt: 10
      }
    })).toBe(1)
    
    await sql.partialUpdate({
      age: {
        lt: 15
      }
    }, { age: 15 })
    expect(await sql.count({
      age: {
        gt: 10
      }
    })).toBe(2)
    
    await close()
  })

  test('DOCUMENT:close lock', async () => {
    const { sql, close } = await createDocumentDatabase('doc-close-lock.db')

    await sql.put({ age: 1 })
    close()
    await expect(sql.put({ age: 1 })).rejects.toThrow()
    await expect(sql.pick({})).rejects.toThrow()
    await expect(sql.delete({ age: 1 })).rejects.toThrow()
  })
})
