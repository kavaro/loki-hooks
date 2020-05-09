# loki-hooks

Loki hooks integrates the member-hooks module into lokijs.
It adds a hooks options to the Loki class constructor options and the addCollection options.
The hooks option allows to add before and after hooks to Loki or collection methods.
Examples:
  - set auto-increment or uuid field on insert
  - add saved event to database

# Installation

```javascript
yarn add loki-hooks
npm install loki-hooks
```

# Usage

See member-hooks module the usage of hooks.
The createHooksLoki function exported by 'loki-hooks' returns a Loki and Collection class enhanced with a hooks option.

```typescript
import test from 'ava'
import sinon from 'sinon'
import Loki from 'lokijs'
import { v4 as uuid } from 'uuid'
import { Hooks, HookMethods } from 'member-hooks'
import { THooksLoki, createHooksLoki } from 'loki-hooks'

interface TSeqOptions {
  field?: string,
  key?: string
}

function seqHook(methods: HookMethods, options?: TSeqOptions): void {
  const { field = 'seq', key = 'seq' } = { ...options }
  methods.before('insert', 10, function (this: any, args: any[]): void {
    const hooks = this.hooks
    const store = hooks.store || (hooks.store = {})
    const doc = args[0]
    doc[field] = store[key] = (store[key] || 0) + 1
  })
}

function saveHook(methods: HookMethods) {
  methods.before('saveDatabaseInternal', 10, function(this: Loki, args: any[]): void {
    if (!this.events.saved) {
      this.events.saved = []
    }
    const fn = args[0]
    args[0] = (err: any) => {
      fn(err)
      if (!err) {
        this.emit('saved')
      }
    }
  })
}

const dbRegistry = new Hooks()
dbRegistry.register('saveDatabaseInternal', saveHook)

const collectionRegistry = new Hooks()
collectionRegistry.register('seq', seqHook)

const HooksLoki = createHooksLoki(dbRegistry, collectionRegistry)

async function save(db: THooksLoki): Promise<void> {
  return new Promise(resolve => {
    db.saveDatabase(resolve)
  })
}

async function load(db: THooksLoki): Promise<void> {
  return new Promise(resolve => {
    db.loadDatabase({}, resolve)
  })
}

test('should add database hooks', async t => {
  const dbName = uuid()
  const db = new HooksLoki(dbName, {
    adapter: new Loki.LokiMemoryAdapter(),
    hooks: {
      config: [['saveDatabaseInternal', {}]]
    }
  })
  const saved = sinon.spy()
  db.addListener('saved', saved)
  await save(db)
  t.assert(saved.calledOnce)
})

test('should add collection hooks', async t => {
  const dbName = uuid()
  const db = new HooksLoki(dbName, { adapter: new Loki.LokiMemoryAdapter() })
  const collection = db.addCollection('collection', {
    disableMeta: true,
    hooks: {
      store: { seq: 10 },
      config: [['seq', { field: 'seq' }]]
    }
  })
  t.deepEqual(collection.insert({ id: 'id1' }), { $loki: 1, id: 'id1', seq: 11 })
  await save(db)
  await load(db)
  t.deepEqual(collection.insert({ id: 'id1' }), { $loki: 2, id: 'id1', seq: 12 })
  const newDb = db.copy()
  t.deepEqual(newDb.getCollection('collection').insert({ id: 'id1' }), { $loki: 2, id: 'id1', seq: 12 })
  db.removeCollection('collection')
  const newCollection = db.addCollection('collection', { disableMeta: true })
  t.deepEqual(newCollection.insert({ id: 'id1' }), { $loki: 1, id: 'id1' })
})

```