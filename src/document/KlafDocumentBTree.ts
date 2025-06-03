import { BPTreeAsync, ValueComparator } from 'serializable-bptree'

export class KlafDocumentBTree<K, V> extends BPTreeAsync<K, V> {
  getVerifier(sign: keyof KlafDocumentBTree<K, V>['verifierMap']) {
    return this.verifierMap[sign]
  }

  async allRecordIds(): Promise<Set<K>> {
    const leftestNode = await this.leftestNode()
    const allKeys = new Set<K>()
    const visited = new Set<string>()
    let node = leftestNode
    while (true) {
      if (visited.has(node.id)) {
        break
      }
      visited.add(node.id)
      const keys = node.keys.flatMap((keys) => keys)
      for (const key of keys) {
        allKeys.add(key)
      }
      if (!node.next) {
        break
      }
      node = await this.getNode(node.next) as any
    }
    return allKeys
  }
}
