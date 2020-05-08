import Loki from 'lokijs'
import { Hooks } from 'member-hooks'
import {
  THookOptions,
  THooksCollection,
  THooksCollectionOptions,
  THooksLoki,
  THooksLokiConfigOptions,
  THooksLokiDbObject
} from './types'

let called = false

/**
 * Enhances Loki constructor and addCollection method with a hooks option.
 * The hooks option allows the user to decorate the database and collection methods hooks as enabled by the member-hooks module.
 * The createHooksLoki function takes a hooks registry (see member-hooks for documentation) as argument and return the HooksLoki class.
 * This registry allows the user to defined hook factory functions.
 * This function should be called only once in the lifetime of the application.
 * 
 * @param registry
 */
export function createHooksLoki(registry: Hooks): THooksLoki {
  /* istanbul ignore if */
  if (called) {
    throw new Error(`createHooksLoki should be called only once`)
  }
  called = true

  function installHooks(obj: THooksLoki | THooksCollection<any>, hookOptions?: THookOptions): void {
    obj.hooks = hookOptions
    const hooksConfig = hookOptions?.config
    /* istanbul ignore else */
    if (hooksConfig) {
      registry.install(obj, hooksConfig)
    }
  }

  const configureOptions = Loki.prototype.configureOptions
  Loki.prototype.configureOptions = function (this: THooksLoki, options: THooksLokiConfigOptions, initialConfig): void {
    configureOptions.call(this, options, initialConfig)
    installHooks(this, options.hooks)
  }

  const loadJSONObject = Loki.prototype.loadJSONObject
  Loki.prototype.loadJSONObject = function (this: THooksLoki, dbObject: THooksLokiDbObject, options): void {
    loadJSONObject.call(this, dbObject, options)
    installHooks(this, dbObject.hooks)
    const collections = this.collections
    /* istanbul ignore else */
    if (collections) {
      collections.forEach((collection: THooksCollection<any>, index) => {
        installHooks(collection, dbObject.collections[index].hooks)
      })
    }
  }

  const addCollection = Loki.prototype.addCollection
  Loki.prototype.addCollection = function <T extends object = any>(this: THooksLoki, name: string, options?: THooksCollectionOptions<T>): Collection<any> {
    const collection = addCollection.call(this, name, options as any) as unknown as THooksCollection<T>
    /* istanbul ignore next */
    const hooks = options ? options.hooks : undefined
    installHooks(collection, hooks)
    return collection
  }

  const removeCollection = Loki.prototype.removeCollection
  Loki.prototype.removeCollection = function (name: string): void {
    registry.uninstall(this.getCollection(name))
    return removeCollection.call(this, name)
  }

  return Loki as unknown as THooksLoki
}
