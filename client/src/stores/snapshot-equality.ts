/** Compare serialized snapshot data without allocating JSON strings or depending on key order. */
export function equalSnapshotValue(previous: unknown, next: unknown): boolean {
  if (Object.is(previous, next)) return true;
  if (previous === null || next === null ||
    typeof previous !== 'object' || typeof next !== 'object') return false;
  if (Array.isArray(previous) || Array.isArray(next)) {
    if (!Array.isArray(previous) || !Array.isArray(next) || previous.length !== next.length) {
      return false;
    }
    return previous.every((value, index) => equalSnapshotValue(value, next[index]));
  }
  const previousRecord = previous as Record<string, unknown>;
  const nextRecord = next as Record<string, unknown>;
  const keys = Object.keys(previousRecord);
  return keys.length === Object.keys(nextRecord).length && keys.every((key) =>
    Object.hasOwn(nextRecord, key) && equalSnapshotValue(previousRecord[key], nextRecord[key]),
  );
}

export function retainSnapshotValue<T>(previous: T, next: T): T {
  return equalSnapshotValue(previous, next) ? previous : next;
}
