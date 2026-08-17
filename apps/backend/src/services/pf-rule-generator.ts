import { BlockedIp, PF_APPLICATION_ANCHOR } from '@network-monitor/shared';

/**
 * Generates macOS PF rules for the application-owned anchor.
 * Pure function with no side effects or system dependencies.
 */
export function generateApplicationRules(blockedIps: BlockedIp[]): string {
  const lines: string[] = [
    `# ====================================================================`,
    `# macOS Real-Time Network Monitor - Dedicated Anchor Rules`,
    `# Anchor: ${PF_APPLICATION_ANCHOR}`,
    `# Generated At: ${new Date().toISOString()}`,
    `# Total Blocked IPs: ${blockedIps.length}`,
    `# ====================================================================`,
    ``,
  ];

  if (blockedIps.length === 0) {
    lines.push(`# No active blocked IP rules.`);
    return lines.join('\n');
  }

  // Deduplicate by normalized IP to ensure clean ruleset
  const seen = new Set<string>();

  for (const item of blockedIps) {
    if (!item.active) continue;
    const ip = item.ip.trim();
    if (!ip || seen.has(ip)) continue;
    seen.add(ip);

    lines.push(`# Block IP: ${ip} (${item.family}) - Added: ${item.blockedAt}`);
    lines.push(`block drop quick from ${ip} to any`);
    lines.push(`block drop quick from any to ${ip}`);
    lines.push(``);
  }

  return lines.join('\n');
}
