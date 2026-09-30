// Generic pagination helper that handles advancing through paginated results.
// Takes a fetchPage function that returns { rows, total }, and handles:
// - Advancing offset by the actual page length returned (not cumulative)
// - Stopping when all rows are fetched
// - Detecting empty pages before reaching total
// - Validating final count matches reported total

export async function fetchAllRows(fetchPage, pageSize) {
  const rows = [];
  let total = null;
  let offset = 0;

  while (rows.length < (total ?? Infinity)) {
    const result = await fetchPage(offset, pageSize);
    const { rows: page, total: resultTotal } = result;

    if (total === null) {
      total = resultTotal;
    }

    if (page.length === 0 && rows.length < total) {
      throw new Error(`Received empty page at offset ${offset} before reaching total of ${total} rows`);
    }

    rows.push(...page);
    offset += page.length;
  }

  if (rows.length !== total) {
    throw new Error(`Fetched ${rows.length} rows but server reports total of ${total}`);
  }

  return rows;
}
