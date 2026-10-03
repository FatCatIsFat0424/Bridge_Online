const MAX_LENGTH = 32;

/**
 * Emoji name from a file name: basename, lowercased, other characters → `_`, 2–32 long,
 * de-duplicated against `taken` with a numeric suffix. The result is added to `taken`.
 */
export function emojiNameFromFile(fileName: string, taken: Set<string>): string {
  const base = fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '').toLowerCase()
    .replace(/[^a-z0-9_]/g, '_').slice(0, MAX_LENGTH).padEnd(2, '_');
  let name = base;
  for (let suffix = 2; taken.has(name); suffix += 1) {
    name = `${base.slice(0, MAX_LENGTH - String(suffix).length - 1)}_${suffix}`;
  }
  taken.add(name);
  return name;
}
