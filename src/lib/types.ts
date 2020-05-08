import { TJSONHook } from 'member-hooks'

export interface THookOptions {
  [key: string]: any
  config: TJSONHook[]
}

export interface THooksCollection<T extends object> extends Collection<T> {
  hooks?: THookOptions
}

export interface THooksLokiDbObject {
  name?: string
  throttledSaves: boolean
  collections: Array<THooksCollection<any>>
  databaseVersion: number
  hooks?: THookOptions
}

export interface THooksLoki extends Loki {
  hooks?: THookOptions
  collections: Array<THooksCollection<any>>
  new(filename: string, options?: Partial<THooksLokiConfigOptions>): THooksLoki
  addCollection(name: string, options?: Partial<THooksCollectionOptions<any>>) : Collection<any>
}

export interface THooksLokiConfigOptions extends LokiConfigOptions {
  hooks: THookOptions
}

export interface THooksCollectionOptions<T> extends CollectionOptions<T> {
  hooks: THookOptions
}

