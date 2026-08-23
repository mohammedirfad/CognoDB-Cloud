export function pickRandom<T>(items: T[], count: number): T[] {
  if (items.length === 0) return [];
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    result.push(items[Math.floor(Math.random() * items.length)]);
  }
  return result;
}
