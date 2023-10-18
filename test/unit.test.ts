import { TissueRoll } from '../'

describe('Create test', () => {
  test('db non exists', () => {
    expect(() => TissueRoll.Open('./non-exists.db')).toThrow()
  })

  test('db open', () => {
    const payloadSize = 250
    const db = TissueRoll.Open('./tissue.db', payloadSize)
    expect(typeof db.root.index).toBe('number')
    expect(typeof db.root.majorVersion).toBe('number')
    expect(typeof db.root.minorVersion).toBe('number')
    expect(typeof db.root.patchVersion).toBe('number')
    expect(db.root.timestamp > Date.now()).toBeFalsy()
    expect(db.root.payloadSize).toBe(payloadSize)
    db.close()
  })
})

describe('Record test', () => {
  let db: TissueRoll
  beforeAll(() => db = TissueRoll.Open('./tissue.db'))
  afterAll(() => db.close())

  test('put record that shorter than page size', () => {
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
  })

  test('put record that longer than page size', () => {
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
        console.log(`Record created: ${recordId}`)
        return recordId
      })

    const res2 = db.pick(db.put('test'))
    expect(res2.record.payload).toBe('test!!')
  })

  test('update', () => {
    const content = 'long text'.repeat(100)
    const longerContent = 'more longer text'.repeat(100)
    const longerContent2 = longerContent+'1'
    const shorterContent = 'shorter token'
    const longerContent3 = longerContent+'2'
    const longestContent = longerContent3.repeat(2)

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

    db
    .onBefore('update', (info) => {
      info.data += '!'
      return info
    })
    .onAfter('update', (info) => {
      console.log(`Record updated: ${info.recordId}`)
      return info
    })
    
    db.update(id, 'test')
    const res6 = db.pick(id)
    expect(res6.record.payload).toBe('test!')
  })

  test('delete', () => {
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
        console.log(`Record deleted: ${recordId}`)
        return recordId
      })

    const id2 = db.put('test content')
    expect(() => db.delete('incorrected id')).toThrow()
    db.delete(id2)
  })

  test('invalid record', () => {
    const invalidId = btoa('1928399199299331123')
    expect(() => db.pick(invalidId)).toThrow()
    expect(() => db.update(invalidId, 'test')).toThrow()
    expect(() => db.delete(invalidId)).toThrow()
  })

  test('exists', () => {
    const correctId = db.put('test')
    const invalidId = correctId+'1'

    expect(db.exists(correctId)).toBe(true)
    expect(db.exists(invalidId)).toBe(false)
  })
})
