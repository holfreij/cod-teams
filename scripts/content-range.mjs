// Parses the Content-Range header to extract the total count.
// Format examples: "0-999/1234" (1234 total), "*/0" (0 total when empty)
export function parseContentRangeTotal(header) {
  if (!header) {
    throw new Error("Content-Range header missing");
  }
  const match = header.match(/^(?:\*|\d+-\d+)\/(\d+)$/);
  if (!match) {
    throw new Error(`Content-Range header unparseable: ${header}`);
  }
  return parseInt(match[1], 10);
}
