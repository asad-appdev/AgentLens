import { describe, it, expect } from 'vitest';
import { PlatformFactory } from '../src/platform/platform.factory.js';
import { PlatformService } from '../src/platform/platform.service.js';
import { MacNetworkProvider } from '../src/platform/macos/mac-network.provider.js';
import { WindowsNetworkProvider } from '../src/platform/windows/windows-network.provider.js';

describe('PlatformFactory & PlatformService Unit Tests', () => {
  it('should instantiate macOS providers when darwin platform is specified', () => {
    const bundle = PlatformFactory.createBundle('darwin');
    expect(bundle).toBeDefined();
    expect(bundle.network).toBeInstanceOf(MacNetworkProvider);
    expect(bundle.system.getPlatformInfo().platform).toBe('darwin');
    expect(bundle.system.getPlatformInfo().os).toBe('macOS');
    expect(bundle.system.getPlatformInfo().supported).toBe(true);
  });

  it('should instantiate Windows providers when win32 platform is specified', () => {
    const bundle = PlatformFactory.createBundle('win32');
    expect(bundle).toBeDefined();
    expect(bundle.network).toBeInstanceOf(WindowsNetworkProvider);
    expect(bundle.system.getPlatformInfo().platform).toBe('win32');
    expect(bundle.system.getPlatformInfo().os).toBe('Windows');
    expect(bundle.system.getPlatformInfo().supported).toBe(true);
  });

  it('should allow runtime platform switching via PlatformService', () => {
    const service = new PlatformService('darwin');
    expect(service.isMacOS()).toBe(true);
    expect(service.isWindows()).toBe(false);
    expect(service.getPlatformInfo().os).toBe('macOS');

    service.setPlatform('win32');
    expect(service.isMacOS()).toBe(false);
    expect(service.isWindows()).toBe(true);
    expect(service.getPlatformInfo().os).toBe('Windows');
    expect(service.getNetworkProvider()).toBeInstanceOf(WindowsNetworkProvider);
  });
});
