import { unlinkSync } from 'fs'
import { TissueRoll, TissueRollDocument } from '../'

const createDatabase = (name: string) => {
  const dbName = `./db-${name}.db`
  const db = TissueRoll.Create(dbName, undefined, true)
  
  const close = () => {
    db.close()
    unlinkSync(dbName)
  }

  return {
    db,
    close
  }
}

const createDocumentDatabase = (name: string) => {
  const dbName = `./sql-${name}.db`
  const sql = TissueRollDocument.Create<{
    name: string
    age: number
    sex?: 'male'|'female'
    more?: any
  }>(dbName, undefined, true)
  
  sql.put({ name: 'kim', age: 10 })
  sql.put({ name: 'tomas', age: 80, sex: 'male' })
  sql.put({ name: 'john', age: 20, sex: 'male' })
  sql.put({ name: 'lee', age: 50, sex: 'female' })
  
  const close = async () => {
    await sql.close()
    unlinkSync(dbName)
  }

  return {
    sql,
    close
  }
}

describe('Create test', () => {
  test('db open', () => {
    const { db, close } = createDatabase('db-open')
    expect(typeof db.metadata.index).toBe('number')
    expect(typeof db.metadata.majorVersion).toBe('number')
    expect(typeof db.metadata.minorVersion).toBe('number')
    expect(typeof db.metadata.patchVersion).toBe('number')
    expect(db.metadata.timestamp > Date.now()).toBeFalsy()
    close()
  })
})

describe('Record test', () => {
  test('put record that shorter than page size', () => {
    const { db, close } = createDatabase('shorter')
    const max = 10
    const ids: string[] = []
    for (let i = 0; i < max; i++) {
      const content = `:db-put-test-${i}:`
      const id = db.put(content)
      ids.push(id)
    }

    const rand = Math.floor(Math.random()*max)
    const target = ids[rand]
    const guess = `:db-put-test-${rand}:`

    const res = db.pick(target)
    expect(res.record.payload).toBe(guess)
    close()
  })

  test('put record that longer than page size', () => {
    const { db, close } = createDatabase('longer')

    const content = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer eros augue, commodo sed laoreet id, euismod id turpis. Vivamus id euismod sapien, vel venenatis turpis. Aliquam at ante odio. Curabitur quis nunc orci. Morbi nibh turpis, placerat quis gravida vestibulum, sollicitudin vel nunc. Curabitur in augue sit amet nibh consectetur posuere. Aliquam erat volutpat. Phasellus nec turpis augue. Cras ut eros nibh. Aenean elementum scelerisque maximus. Cras id nulla at felis molestie suscipit eu ac erat. Nulla tincidunt ornare nulla. Etiam vitae est sed arcu congue dignissim. Nam at odio eget velit hendrerit tincidunt. Sed posuere porttitor volutpat.

    Praesent molestie feugiat lectus, sed molestie odio pulvinar a. Sed vitae ullamcorper dui, sit amet lobortis ipsum. Curabitur orci risus, mattis eget elit a, ornare egestas justo. Morbi vitae convallis ex. Nulla id nisi ultricies, rutrum nulla nec, consequat velit. Maecenas eleifend quis felis in fringilla. In nec risus dapibus, bibendum nunc quis, commodo ex. Donec urna quam, pharetra eu nisl vel, vestibulum feugiat sem. Fusce sodales, odio a aliquet vestibulum, nisi nulla interdum nisi, nec aliquam est tortor quis metus. Sed eu metus venenatis, fringilla lacus a, pharetra lectus.
    
    Phasellus dolor massa, lacinia in massa id, vestibulum bibendum sem. Vestibulum a tortor pulvinar, bibendum nibh sed, interdum lacus. Etiam ut urna et sapien egestas eleifend id quis turpis. Ut condimentum sollicitudin augue, sit amet imperdiet lectus pulvinar ut. Proin sagittis vel orci eu porttitor. Nam luctus non ante non volutpat. Sed nec sem at erat consectetur placerat. Curabitur lacinia maximus commodo. Vivamus nec condimentum mauris, eu commodo arcu. Suspendisse potenti. Aliquam quis tristique nibh. Quisque vulputate ex id urna laoreet gravida.
    
    Fusce interdum magna et euismod luctus. Proin ullamcorper dictum imperdiet. Cras sodales congue tempus. Donec eu sapien quis velit elementum lacinia. Donec scelerisque blandit tortor vel hendrerit. Nulla quis turpis vitae sem vehicula pretium. Sed lacinia, nulla vitae mollis luctus, odio felis volutpat enim, sed dictum dolor neque sit amet mauris. Praesent et sem ullamcorper, dictum leo sit amet, ullamcorper dolor. Nullam auctor arcu ipsum, sit amet consectetur massa finibus vitae. Aenean vehicula, dui in blandit semper, dui lorem tincidunt ex, nec semper est ante vel nulla. Ut condimentum lobortis convallis. Nullam a rutrum velit, eget suscipit elit.
    
    Etiam molestie purus imperdiet nisi dignissim, id fermentum turpis laoreet. Sed ut nibh lacinia, maximus massa non, convallis mi. In id diam blandit, pulvinar nisl a, maximus diam. Etiam dignissim euismod libero eget congue. Vivamus iaculis pulvinar odio ac maximus. Pellentesque ac placerat nulla. Aliquam erat volutpat. Nam eget enim eget est varius commodo. Suspendisse efficitur ante vel rutrum suscipit. Morbi pulvinar lobortis elit, quis efficitur lectus dapibus ac. Mauris leo tellus, mattis et ornare pharetra, facilisis nec lectus. Aenean sed ornare felis. Aenean vestibulum accumsan tortor vel ullamcorper. Maecenas eleifend enim libero, at convallis sem ullamcorper eget.`

    const id = db.put(content)

    db.put('meaningless dummy data')

    const res = db.pick(id)
    expect(res.record.payload).toBe(content)
    
    db
      .onBefore('put', (data) => data+'!')
      .onBefore('put', (data) => data+'!')
      .onAfter('put', (recordId) => {
        return recordId
      })

    const res2 = db.pick(db.put('test'))
    expect(res2.record.payload).toBe('test!!')
    close()
  })

  test('update', () => {
    const { db, close } = createDatabase('update')

    const content = 'long text'.repeat(100)
    const longerContent = 'more longer text'.repeat(100)
    const longerContent2 = 'more more longer text'.repeat(100)
    const shorterContent = 'shorter token'
    const longerContent3 = 'very more more longer text'.repeat(100)
    const longestContent = 'very more more longest text'.repeat(100)

    const id = db.put(content)
    
    db.update(id, longerContent)
    const res1 = db.pick(id)
    expect(res1.record.payload).toBe(longerContent)
    expect(res1.record.header.maxLength).toBe(longerContent.length)

    db.update(id, longerContent2)
    const res2 = db.pick(id)
    expect(res2.record.payload).toBe(longerContent2)
    
    db.update(id, shorterContent)
    const res3 = db.pick(id)
    expect(res3.record.payload).toBe(shorterContent)
    
    db.update(id, longerContent3)
    const res4 = db.pick(id)
    expect(res4.record.payload).toBe(longerContent3)

    db.update(id, longestContent)
    const res5 = db.pick(id)
    expect(res5.record.payload).toBe(longestContent)
    
    // expect(res5.record.header.id).toBe(res1.record.header.id)

    db
    .onBefore('update', (info) => {
      info.data += '!'
      return info
    })
    .onAfter('update', (info) => {
      return info
    })
    
    db.update(id, 'test')
    const res6 = db.pick(id)
    expect(res6.record.payload).toBe('test!')
    close()
  })

  test('delete', () => {
    const { db, close } = createDatabase('delete')

    const content = 'you should can not read this'

    const id = db.put(content)
    db.delete(id)
    expect(() => db.pick(id)).toThrow()
    expect(() => db.update(id, 'error')).toThrow()

    db
      .onBefore('delete', (recordId) => {
        if (!db.exists(recordId)) {
          throw new Error(`Not exists: ${recordId}`)
        }
        return recordId
      })
      .onAfter('delete', (recordId) => {
        return recordId
      })

    const id2 = db.put('test content')
    expect(() => db.delete('incorrected id')).toThrow()
    db.delete(id2)
    close()
  })

  test('invalid record', () => {
    const { db, close } = createDatabase('invalid-record')

    const invalidId = btoa('1928399199299331123')
    expect(() => db.pick(invalidId)).toThrow()
    expect(() => db.update(invalidId, 'test')).toThrow()
    expect(() => db.delete(invalidId)).toThrow()
    close()
  })

  test('exists', () => {
    const { db, close } = createDatabase('exists')

    const correctId = db.put('test')
    const invalidId = correctId+'1'

    expect(db.exists(correctId)).toBe(true)
    expect(db.exists(invalidId)).toBe(false)
    close()
  })

  test('getRecords', () => {
    const { db, close } = createDatabase('get-records')

    const largeData = ' '.repeat(10000)
    db.put(largeData)

    const guessData1 = 'a'
    const guessData2 = 'b'
    const guessData3 = 'c'

    const id = db.put(guessData1)
    db.put(guessData2)
    db.put(guessData3)

    const record = db.pick(id)
    const records = db.getRecords(record.page.index)

    expect(records[0].payload).toBe(guessData1)
    expect(records[1].payload).toBe(guessData2)
    expect(records[2].payload).toBe(guessData3)
    close()
  })

  test('autoIncrement', () => {
    const { db, close } = createDatabase('auto-increment')

    const sampleId = db.put('a')
    db.put('b')
    db.put('c')
    db.put('longer'.repeat(1000))
    db.put('e')
    expect(Number(db.metadata.autoIncrement)).toBe(5)

    db.update(sampleId, 'more longer')
    expect(Number(db.metadata.autoIncrement)).toBe(5)

    db.delete(sampleId)
    expect(Number(db.metadata.autoIncrement)).toBe(5)

    close()
  })

  test('count', () => {
    const { db, close } = createDatabase('count')

    const sampleId = db.put('a')
    db.put('b')
    db.put('c')
    db.put('longer'.repeat(1000))
    db.put('e')
    expect(Number(db.metadata.count)).toBe(5)

    db.update(sampleId, 'more longer')
    expect(Number(db.metadata.count)).toBe(5)

    db.delete(sampleId)
    expect(Number(db.metadata.count)).toBe(4)

    close()
  })
})

describe('DOCUMENT', () => {
  test('DOCUMENT:put', async () => {
    const { sql, close } = createDocumentDatabase('put')

    const result1 = sql.pick({
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
      expect(record).toEqual(expect.objectContaining(expect1[i]))
    })

    const result2 = sql.pick({
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
      expect(record).toEqual(expect.objectContaining(expect2[i]))
    })

    await close()
  })

  test('DOCUMENT:delete', async () => {
    const { sql, close } = createDocumentDatabase('delete') 

    const delCount = sql.delete({
      name: {
        equal: 'tomas'
      }
    })
    const result1 = sql.pick({})
    const expect1 = [
      { name: 'kim', age: 10 },
      { name: 'john', age: 20, sex: 'male' },
      { name: 'lee', age: 50, sex: 'female' },
    ]
    result1.forEach((record, i) => {
      expect(record).toEqual(expect.objectContaining(expect1[i]))
    })

    sql.delete({})
    expect(delCount).toBe(1)
    expect(sql.pick({})).toEqual([])

    await close()
  })

  test('DOCUMENT:update:partial', async () => {
    const { sql, close } = createDocumentDatabase('update-partial')

    const updatedCount = sql.partialUpdate({
      name: {
        equal: 'kim'
      }
    }, {
      age: 22,
      sex: 'female'
    })

    const result1 = sql.pick({
      name: {
        equal: 'kim'
      }
    })
    const expect1 = [
      { name: 'kim', age: 22, sex: 'female' }
    ]
    result1.forEach((record, i) => {
      expect(record).toEqual(expect.objectContaining(expect1[i]))
    })
    expect(updatedCount).toBe(1)

    await close()
  })

  test('DOCUMENT:update:full-1', async () => {
    const { sql, close } = createDocumentDatabase('update-full-1')

    const updatedCount = sql.fullUpdate({
      age: {
        gt: 15,
        lt: 75
      }
    }, { name: 'unknown', age: 0, sex: 'male' })

    const result1 = sql.pick({})
    const expect1 = [
      { name: 'kim', age: 10 },
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'unknown', age: 0, sex: 'male' },
      { name: 'unknown', age: 0, sex: 'male' },
    ]
    result1.forEach((record, i) => {
      expect(record).toEqual(expect.objectContaining(expect1[i]))
    })
    expect(updatedCount).toBe(2)

    await close()
  })

  test('DOCUMENT:update:full-2', async () => {
    const { sql, close } = createDocumentDatabase('update-full-2')

    const updatedCount = sql.fullUpdate({
      age: {
        gt: 15,
        lt: 75
      }
    }, (record) => ({
      name: record.name,
      age: 0,
      sex: record.sex
    }))

    const result1 = sql.pick({})
    const expect1 = [
      { name: 'kim', age: 10 },
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'john', age: 0, sex: 'male' },
      { name: 'lee', age: 0, sex: 'female' },
    ]
    result1.forEach((record, i) => {
      expect(record).toEqual(expect.objectContaining(expect1[i]))
    })
    expect(updatedCount).toBe(2)

    await close()
  })

  test('DOCUMENT:pick:query', async () => {
    const { sql, close } = createDocumentDatabase('pick-query')

    const result1 = sql.pick({
      name: 'kim'
    })
    const expect1 = [
      { name: 'kim', age: 10 }
    ]
    result1.forEach((record, i) => {
      expect(record).toEqual(expect.objectContaining(expect1[i]))
    })

    const result2 = sql.pick({
      name: 'kim',
      age: 10
    })
    const expect2 = [
      { name: 'kim', age: 10 }
    ]
    result2.forEach((record, i) => {
      expect(record).toEqual(expect.objectContaining(expect2[i]))
    })

    const result3 = sql.pick({
      name: 'kim',
      age: 11
    })
    expect(result3).toEqual([])

    await close()
  })

  test('DOCUMENT:pick:range-1', async () => {
    const { sql, close } = createDocumentDatabase('pick-range-1')

    const result1 = sql.pick({
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
      expect(record).toEqual(expect.objectContaining(expect1[i]))
    })

    const result2 = sql.pick({}, {
      order: 'sex',
    })
    const expect2 = [
      { name: 'kim', age: 10 },
      { name: 'lee', age: 50, sex: 'female' },
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'john', age: 20, sex: 'male' },
    ]
    result2.forEach((record, i) => {
      expect(record).toEqual(expect.objectContaining(expect2[i]))
    })

    const result3 = sql.pick({
      name: {
        like: 'l%'
      }
    })
    const expect3 = [
      { name: 'lee', age: 50, sex: 'female' },
    ]
    result3.forEach((record, i) => {
      expect(record).toEqual(expect.objectContaining(expect3[i]))
    })

    const result4 = sql.pick({
      name: {
        like: '%o%'
      }
    })
    const expect4 = [
      { name: 'tomas', age: 80, sex: 'male' },
      { name: 'john', age: 20, sex: 'male' },
    ]
    result4.forEach((record, i) => {
      expect(record).toEqual(expect.objectContaining(expect4[i]))
    })

    await close()
  })

  test('DOCUMENT:pick:range-2', async () => {
    const { sql, close } = createDocumentDatabase('pick-range-2')

    for (let i = 0; i < 100; i++) {
      sql.put({ name: 'unknown', age: i })
    }

    const result1 = sql.pick({
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
      expect(record).toEqual(expect.objectContaining(expect1[i]))
    })

    await close()
  })

  test('DOCUMENT:autoIncrement', async () => {
    const { sql, close } = createDocumentDatabase('auto-increment')
    expect(sql.metadata.autoIncrement).toBe(4n)

    sql.partialUpdate({ name: 'kim' }, { name: 'kim'.repeat(10000) })
    expect(sql.metadata.autoIncrement).toBe(4n)

    sql.delete({ name: 'kim' })
    expect(sql.metadata.autoIncrement).toBe(4n)

    await close()
  })

  test('DOCUMENT:count', async () => {
    const { sql, close } = createDocumentDatabase('count')
    expect(sql.metadata.count).toBe(4)

    sql.partialUpdate({ name: 'kim' }, { name: 'kim'.repeat(10000) })
    expect(sql.metadata.count).toBe(4)

    sql.delete({ name: 'kim' })
    expect(sql.metadata.count).toBe(4)

    sql.delete({ sex: 'male' })
    expect(sql.metadata.count).toBe(2)

    await close()
  })

  test('DOCUMENT:count method', async () => {
    const { sql, close } = createDocumentDatabase('count')
    expect(sql.count({
      age: {
        gt: 10
      }
    })).toBe(3)

    sql.delete({ sex: 'male' })
    expect(sql.count({
      age: {
        gt: 10
      }
    })).toBe(1)
    
    sql.partialUpdate({
      age: {
        lt: 15
      }
    }, { age: 15 })
    expect(sql.count({
      age: {
        gt: 10
      }
    })).toBe(2)
    
    await close()
  })
})
