export type BankOptionInput = {
  name: string;
  code: string;
  slug?: string | null;
};

export function normalizeBankOptions<T extends BankOptionInput>(banks: T[]) {
  const seen = new Set<string>();
  const options: Array<T & { optionKey: string }> = [];

  for (const bank of banks) {
    const identity = `${bank.code.trim().toLowerCase()}::${bank.name.trim().toLowerCase()}::${bank.slug?.trim().toLowerCase() ?? ""}`;
    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    options.push({
      ...bank,
      optionKey: `${bank.code}-${bank.slug ?? bank.name}-${options.length}`,
    });
  }

  return options;
}
