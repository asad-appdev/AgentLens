import { Router, Request, Response } from 'express';
import { platformService } from '../platform/index.js';

export const firewallRouter = Router();

/**
 * POST /api/firewall/block-ip and POST /api/block-ip
 * Blocks a remote IP address in the application-owned platform firewall.
 */
export async function handleBlockIp(req: Request, res: Response): Promise<void> {
  const { ip, comment } = req.body;

  if (!ip || typeof ip !== 'string') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'IP address string is required in request body',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const firewall = platformService.getFirewallProvider();
  const result = await firewall.blockIp(ip, comment);

  if (!result.success) {
    const statusCode = result.errorCode === 'PROTECTED_IP' ? 403 : result.errorCode === 'INSUFFICIENT_PRIVILEGES' ? 403 : 400;
    res.status(statusCode).json({
      success: false,
      error: {
        code: result.errorCode || 'BLOCK_FAILED',
        message: result.error || 'Failed to block IP',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: result.blockedIp,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/firewall/unblock-ip and POST /api/unblock-ip
 * Unblocks an IP address from the application-owned platform firewall.
 */
export async function handleUnblockIp(req: Request, res: Response): Promise<void> {
  const { ip } = req.body;

  if (!ip || typeof ip !== 'string') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'IP address string is required in request body',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const firewall = platformService.getFirewallProvider();
  const result = await firewall.unblockIp(ip);

  if (!result.success) {
    const statusCode = result.errorCode === 'BLOCK_NOT_FOUND' ? 404 : result.errorCode === 'INSUFFICIENT_PRIVILEGES' ? 403 : 400;
    res.status(statusCode).json({
      success: false,
      error: {
        code: result.errorCode || 'UNBLOCK_FAILED',
        message: result.error || 'Failed to unblock IP',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: { unblockedIp: result.unblockedIp },
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/firewall/blocked-ips and GET /api/blocked-ips
 */
export function handleGetBlockedIps(_req: Request, res: Response): void {
  const firewall = platformService.getFirewallProvider();
  const blockedIps = firewall.getBlockedIps();

  res.status(200).json({
    timestamp: new Date().toISOString(),
    total: blockedIps.length,
    blockedIps,
  });
}

firewallRouter.post('/block-ip', handleBlockIp);
firewallRouter.post('/unblock-ip', handleUnblockIp);
firewallRouter.get('/blocked-ips', handleGetBlockedIps);

/**
 * GET /api/firewall/status
 */
firewallRouter.get('/status', (_req: Request, res: Response) => {
  const firewall = platformService.getFirewallProvider();
  const status = firewall.getFirewallStatus();
  res.status(200).json(status);
});

/**
 * GET /api/firewall/events
 */
firewallRouter.get('/events', (_req: Request, res: Response) => {
  const firewall = platformService.getFirewallProvider();
  const events = firewall.getAuditEvents();

  res.status(200).json({
    timestamp: new Date().toISOString(),
    total: events.length,
    events,
  });
});

