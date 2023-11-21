export class IterableSet {
  static Intersections<T>(iterables: Iterable<T>[]): T[] {
    const count = new Map<T, number>()
    const intersections: T[] = []
    const max = iterables.length
    for (const keys of iterables) {
      for (const k of keys) {
        let v = count.get(k) ?? 0
        if (v >= max) {
          continue
        }
        count.set(k, ++v)
        if (v === max) {
          intersections.push(k)
        }
      }
    }
    return intersections
  }

  static Union<T>(iterables: Iterable<T>[]): T[] {
    const union: T[] = []
    for (const keys of iterables) {
      for (const k of keys) {
        if (!union.includes(k)) {
          union.push(k)
        }
      }
    }
    return union
  }
}
