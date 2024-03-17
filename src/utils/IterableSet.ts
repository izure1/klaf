export class IterableSet {
  static Intersections<T>(iterables: Iterable<T>[]): T[] {
    let intersection = new Set(iterables.shift() ?? [])
    for (const iterable of iterables) {
      const found = []
      for (const t of iterable) {
        for (const guess of intersection) {
          if (t === guess) {
            found.push(t)
            break
          }
        }
      }
      intersection = new Set(found)
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
