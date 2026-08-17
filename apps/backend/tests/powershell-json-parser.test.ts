import { describe, it, expect } from 'vitest';
import { safeParsePowerShellJson } from '../src/platform/windows/parsers/powershell-json.parser.js';

describe('safeParsePowerShellJson', () => {
  it('should return empty array for null, undefined, or empty string', () => {
    expect(safeParsePowerShellJson('')).toEqual([]);
    expect(safeParsePowerShellJson('   \n  ')).toEqual([]);
  });

  it('should parse a single JSON object into an array of 1 item', () => {
    const singleObj = '{"LocalAddress":"127.0.0.1","LocalPort":5174,"OwningProcess":48231}';
    const result = safeParsePowerShellJson<{ LocalAddress: string; LocalPort: number }>(singleObj);
    expect(result).toHaveLength(1);
    expect(result[0]!.LocalAddress).toBe('127.0.0.1');
    expect(result[0]!.LocalPort).toBe(5174);
  });

  it('should parse an array of JSON objects', () => {
    const arrayJson = '[{"LocalAddress":"127.0.0.1","LocalPort":5174},{"LocalAddress":"0.0.0.0","LocalPort":3000}]';
    const result = safeParsePowerShellJson<{ LocalAddress: string; LocalPort: number }>(arrayJson);
    expect(result).toHaveLength(2);
    expect(result[0]!.LocalPort).toBe(5174);
    expect(result[1]!.LocalPort).toBe(3000);
  });

  it('should recover concatenated JSON blocks when PowerShell emits multiple objects', () => {
    const multiBlock = '{"ProcessId":100,"Name":"node.exe"}{"ProcessId":200,"Name":"python.exe"}';
    const result = safeParsePowerShellJson<{ ProcessId: number; Name: string }>(multiBlock);
    expect(result).toHaveLength(2);
    expect(result[0]!.Name).toBe('node.exe');
    expect(result[1]!.Name).toBe('python.exe');
  });

  it('should gracefully handle malformed JSON', () => {
    const invalid = 'Get-NetTCPConnection : The term is not recognized';
    const result = safeParsePowerShellJson(invalid);
    expect(result).toEqual([]);
  });
});
