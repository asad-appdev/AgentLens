/**
 * Formats bytes per second into human-readable strings using decimal standard (1 KB/s = 1000 B/s).
 */
export function formatBytesPerSec(bytesPerSec: number | undefined | null): string {
  if (bytesPerSec === undefined || bytesPerSec === null || isNaN(bytesPerSec) || bytesPerSec <= 0) {
    return '0 B/s';
  }

  if (bytesPerSec < 1000) {
    return `${bytesPerSec} B/s`;
  } else if (bytesPerSec < 1000 * 1000) {
    return `${(bytesPerSec / 1000).toFixed(1)} KB/s`;
  } else if (bytesPerSec < 1000 * 1000 * 1000) {
    return `${(bytesPerSec / (1000 * 1000)).toFixed(2)} MB/s`;
  } else {
    return `${(bytesPerSec / (1000 * 1000 * 1000)).toFixed(2)} GB/s`;
  }
}

/**
 * Formats total bytes into human-readable strings.
 */
export function formatBytes(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) {
    return '0 B';
  }

  if (bytes < 1000) {
    return `${bytes} B`;
  } else if (bytes < 1000 * 1000) {
    return `${(bytes / 1000).toFixed(1)} KB`;
  } else if (bytes < 1000 * 1000 * 1000) {
    return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1000 * 1000 * 1000)).toFixed(2)} GB`;
  }
}
