/** Search only the supplied Product Master options; never fetch or expose documents. */
const normalize = (value: string): string =>
  value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('id-ID').trim();

export function filterAdminProductOptions(options: readonly string[], query: string): string[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...options];
  return options.filter(name => {
    const normalizedName = normalize(name);
    return terms.every(term => normalizedName.includes(term));
  });
}
