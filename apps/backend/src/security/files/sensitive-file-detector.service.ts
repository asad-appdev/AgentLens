import {
  SensitiveFileAccess,
  SensitiveFileCategory,
  FileSensitivity,
} from '@network-monitor/shared';
import path from 'path';

interface SensitiveFileRule {
  category: SensitiveFileCategory;
  sensitivity: FileSensitivity;
  patterns: RegExp[];
}

const SENSITIVE_RULES: SensitiveFileRule[] = [
  // 1. Credentials
  {
    category: 'credentials',
    sensitivity: 'high',
    patterns: [
      /^\.env(\..+)?$/i,
      /credentials\.json$/i,
      /secrets?\.(ya?ml|json|env)$/i,
      /master\.key$/i,
      /auth\.json$/i,
      /\.htpasswd$/i,
      /wp-config\.php$/i,
    ],
  },
  // 2. SSH Keys
  {
    category: 'ssh',
    sensitivity: 'critical',
    patterns: [
      /[\\/]\.ssh[\\/](id_rsa|id_ed25519|id_ecdsa|id_dsa)(\.pub)?$/i,
      /[\\/]\.ssh[\\/](known_hosts|authorized_keys|config)$/i,
      /\.ssh$/i,
    ],
  },
  // 3. Cloud Provider Credentials
  {
    category: 'cloud',
    sensitivity: 'critical',
    patterns: [
      /[\\/]\.aws[\\/](credentials|config)$/i,
      /[\\/]\.gcp[\\/].+\.json$/i,
      /[\\/]\.azure[\\/].+$/i,
      /[\\/]\.kube[\\/]config$/i,
      /gcloud.*credentials\.db$/i,
    ],
  },
  // 4. Git Repositories & Tokens
  {
    category: 'git',
    sensitivity: 'medium',
    patterns: [
      /[\\/]\.git[\\/]config$/i,
      /[\\/]\.git-credentials$/i,
    ],
  },
  // 5. Package & API Tokens
  {
    category: 'tokens',
    sensitivity: 'high',
    patterns: [
      /^\.npmrc$/i,
      /^\.pypirc$/i,
      /token\.json$/i,
      /api[_-]?keys?(\.json|\.txt)?$/i,
    ],
  },
  // 6. Certificates & Private Keys
  {
    category: 'certificates',
    sensitivity: 'critical',
    patterns: [
      /\.(pem|key|pfx|p12|pkcs12)$/i,
      /server\.(crt|cer)$/i,
    ],
  },
];

export class SensitiveFileDetectorService {
  private recentAccesses: SensitiveFileAccess[] = [];
  private maxHistory = 500;

  /**
   * Classifies a target file path based strictly on file name / directory patterns.
   * NEVER reads or inspects file content.
   */
  public classifyPath(filePath: string): { category: SensitiveFileCategory; sensitivity: FileSensitivity } | null {
    if (!filePath) return null;
    const normalized = filePath.trim();
    const basename = path.basename(normalized);

    for (const rule of SENSITIVE_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(normalized) || pattern.test(basename)) {
          return {
            category: rule.category,
            sensitivity: rule.sensitivity,
          };
        }
      }
    }

    return null;
  }

  /**
   * Records a sensitive file access event with safe metadata ONLY.
   */
  public recordAccess(
    filePath: string,
    accessedBy: string,
    pid: number,
    processName: string
  ): SensitiveFileAccess | null {
    const classification = this.classifyPath(filePath);
    if (!classification) return null;

    // Sanitize path for display (replace home directory with ~)
    const sanitizedPath = filePath.replace(new RegExp('^' + (process.env.HOME || process.env.USERPROFILE || '')), '~');

    const record: SensitiveFileAccess = {
      id: `file-acc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      path: sanitizedPath,
      category: classification.category,
      accessedBy,
      pid,
      processName,
      timestamp: new Date().toISOString(),
      sensitivity: classification.sensitivity,
      isRedacted: true, // Guaranteed zero content stored
    };

    this.recentAccesses.unshift(record);
    if (this.recentAccesses.length > this.maxHistory) {
      this.recentAccesses = this.recentAccesses.slice(0, this.maxHistory);
    }

    return record;
  }

  /**
   * Retrieves recent sensitive file access metadata logs.
   */
  public getRecentAccesses(limit = 50, category?: SensitiveFileCategory): SensitiveFileAccess[] {
    let list = this.recentAccesses;
    if (category) {
      list = list.filter((r) => r.category === category);
    }
    return list.slice(0, limit);
  }

  /**
   * Clears in-memory file access history.
   */
  public clearHistory(): void {
    this.recentAccesses = [];
  }
}

export const sensitiveFileDetectorService = new SensitiveFileDetectorService();
