/**
 * Safely parses JSON output from PowerShell `ConvertTo-Json -Compress`.
 * Handles single-object vs array results, empty strings, and malformed outputs.
 */
export function safeParsePowerShellJson<T>(rawOutput: string): T[] {
  if (!rawOutput) return [];
  const trimmed = rawOutput.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed as T[];
    }
    if (parsed && typeof parsed === 'object') {
      return [parsed as T];
    }
    return [];
  } catch {
    // If output contains multiple concatenated JSON objects or PowerShell warnings
    const objects: T[] = [];
    const jsonBlocks = trimmed.match(/\{[^{}]*\}/g);
    if (jsonBlocks) {
      for (const block of jsonBlocks) {
        try {
          const item = JSON.parse(block);
          if (item && typeof item === 'object') {
            objects.push(item as T);
          }
        } catch {
          // Skip invalid sub-block
        }
      }
    }
    return objects;
  }
}
