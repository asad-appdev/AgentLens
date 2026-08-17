import { Router, Request, Response } from 'express';
import { platformService } from '../platform/index.js';

export const localServersRouter = Router();

/**
 * GET /api/local-servers
 * Discovers all active local listening servers and classifies dev server runtimes.
 */
localServersRouter.get('/local-servers', async (_req: Request, res: Response) => {
  try {
    const detector = platformService.getServerDetector();
    const servers = await detector.discoverLocalServers();
    res.status(200).json({ servers, count: servers.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/kill
 * Terminates a process by its verified PID using platform process provider.
 */
localServersRouter.post('/kill', async (req: Request, res: Response) => {
  const { pid, signal, dryRun } = req.body;
  const parsedPid = parseInt(pid, 10);

  if (isNaN(parsedPid) || parsedPid <= 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PID',
        message: 'Valid positive integer PID is required.',
      },
    });
    return;
  }

  try {
    const processProvider = platformService.getProcessProvider();
    const result = await processProvider.terminateProcess(parsedPid, signal, dryRun);
    const statusCode = result.success ? 200 : result.errorCode === 'INSUFFICIENT_PRIVILEGES' ? 403 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message,
      },
    });
  }
});

/**
 * POST /api/kill-port
 * Resolves the PID from the current port state and terminates the process safely.
 */
localServersRouter.post('/kill-port', async (req: Request, res: Response) => {
  const { port, protocol, signal, expectedPid } = req.body;
  const parsedPort = parseInt(port, 10);

  if (isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    res.status(400).json({ error: 'Valid port number between 1 and 65535 is required.' });
    return;
  }

  try {
    const detector = platformService.getServerDetector();
    const result = await detector.killPort({
      port: parsedPort,
      protocol,
      signal,
      expectedPid,
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/kill-processes
 * Batch terminates multiple selected processes or ports with post-cleanup release verification.
 */
localServersRouter.post('/kill-processes', async (req: Request, res: Response) => {
  const { pids, ports, signal } = req.body;

  if ((!pids || !Array.isArray(pids) || pids.length === 0) && (!ports || !Array.isArray(ports) || ports.length === 0)) {
    res.status(400).json({ error: 'At least one PID or port must be specified in request body.' });
    return;
  }

  try {
    const detector = platformService.getServerDetector();
    const result = await detector.killProcesses({
      pids,
      ports,
      signal,
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

