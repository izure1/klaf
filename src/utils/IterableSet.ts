export class IterableSet {
  static Intersections<T>(iterables: Iterable<T>[]): T[] {
    let intersection = new Set<T>(iterables.shift() ?? [])
    for (const set of iterables) {
      const found = new Set<T>()
      for (const element of set) {
        for (const guess of intersection) {
          if (element === guess) {
            found.add(element)
            break
          }
        }
      }
      intersection = found
    }
    return Array.from(intersection)
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
