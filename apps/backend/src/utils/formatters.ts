/**
 * Formats a raw byte count into human readable decimal string (B, KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1000;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeIndex = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(dm))} ${sizes[safeIndex]}`;
}

/**
 * Formats a raw byte rate into a throughput rate string (B/s, KB/s, MB/s, GB/s).
 */
export function formatBytesPerSec(bytesPerSec: number, decimals = 1): string {
  if (bytesPerSec <= 0 || isNaN(bytesPerSec)) return '0 B/s';
  const formatted = formatBytes(bytesPerSec, decimals);
  return `${formatted}/s`;
}
