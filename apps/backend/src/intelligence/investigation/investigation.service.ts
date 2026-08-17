import {
  InvestigationWorkspace,
  InvestigationItem,
  InvestigationNote,
} from '@network-monitor/shared';

export class InvestigationService {
  private readonly workspaces = new Map<string, InvestigationWorkspace>();

  constructor() {
    // Seed initial demo investigation
    const initialId = 'inv-default-1';
    this.workspaces.set(initialId, {
      id: initialId,
      title: 'Active Network & AI Agent Investigation',
      description: 'Default investigation workspace for pinning observed processes, AI agents, and remote endpoints.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
      notes: [],
      timeline: [
        {
          timestamp: new Date().toISOString(),
          eventType: 'investigation_created',
          description: 'Investigation workspace initialized.',
          severity: 'INFO',
        },
      ],
    });
  }

  public listInvestigations(): InvestigationWorkspace[] {
    return Array.from(this.workspaces.values());
  }

  public getInvestigation(id: string): InvestigationWorkspace | undefined {
    return this.workspaces.get(id);
  }

  public createInvestigation(title: string, description = ''): InvestigationWorkspace {
    const id = `inv-${Date.now()}`;
    const now = new Date().toISOString();
    const ws: InvestigationWorkspace = {
      id,
      title: title.trim(),
      description: description.trim(),
      createdAt: now,
      updatedAt: now,
      items: [],
      notes: [],
      timeline: [
        {
          timestamp: now,
          eventType: 'investigation_created',
          description: `Investigation "${title}" created.`,
          severity: 'INFO',
        },
      ],
    };
    this.workspaces.set(id, ws);
    return ws;
  }

  public updateInvestigation(id: string, partial: { title?: string; description?: string }): InvestigationWorkspace | null {
    const ws = this.workspaces.get(id);
    if (!ws) return null;

    if (partial.title) ws.title = partial.title.trim();
    if (partial.description !== undefined) ws.description = partial.description.trim();
    ws.updatedAt = new Date().toISOString();
    return ws;
  }

  public deleteInvestigation(id: string): boolean {
    return this.workspaces.delete(id);
  }

  public addItem(
    investigationId: string,
    type: InvestigationItem['type'],
    targetId: string,
    title: string,
    metadata?: Record<string, unknown>
  ): InvestigationItem | null {
    const ws = this.workspaces.get(investigationId);
    if (!ws) return null;

    const item: InvestigationItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type,
      targetId,
      title,
      timestamp: new Date().toISOString(),
      metadata,
    };

    ws.items.push(item);
    ws.timeline.push({
      timestamp: item.timestamp,
      eventType: 'item_pinned',
      description: `Pinned ${type.toUpperCase()}: ${title}`,
      severity: 'INFO',
    });
    ws.updatedAt = new Date().toISOString();
    return item;
  }

  public removeItem(investigationId: string, itemId: string): boolean {
    const ws = this.workspaces.get(investigationId);
    if (!ws) return false;
    const initialLen = ws.items.length;
    ws.items = ws.items.filter((i) => i.id !== itemId);
    ws.updatedAt = new Date().toISOString();
    return ws.items.length < initialLen;
  }

  public addNote(investigationId: string, text: string): InvestigationNote | null {
    const ws = this.workspaces.get(investigationId);
    if (!ws || !text.trim()) return null;

    const note: InvestigationNote = {
      id: `note-${Date.now()}`,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    ws.notes.push(note);
    ws.timeline.push({
      timestamp: note.timestamp,
      eventType: 'note_added',
      description: `Note added: "${note.text.substring(0, 40)}..."`,
      severity: 'INFO',
    });
    ws.updatedAt = new Date().toISOString();
    return note;
  }

  public removeNote(investigationId: string, noteId: string): boolean {
    const ws = this.workspaces.get(investigationId);
    if (!ws) return false;
    const initialLen = ws.notes.length;
    ws.notes = ws.notes.filter((n) => n.id !== noteId);
    ws.updatedAt = new Date().toISOString();
    return ws.notes.length < initialLen;
  }

  public exportInvestigation(investigationId: string, format: 'json' | 'csv' | 'html'): { content: string; mimeType: string; filename: string } | null {
    const ws = this.workspaces.get(investigationId);
    if (!ws) return null;

    if (format === 'json') {
      return {
        content: JSON.stringify(ws, null, 2),
        mimeType: 'application/json',
        filename: `${ws.id}.json`,
      };
    }

    if (format === 'csv') {
      const rows = [
        ['Timestamp', 'Event Type', 'Description', 'Severity'],
        ...ws.timeline.map((t) => [t.timestamp, t.eventType, `"${t.description.replace(/"/g, '""')}"`, t.severity || 'INFO']),
      ];
      return {
        content: rows.map((r) => r.join(',')).join('\n'),
        mimeType: 'text/csv',
        filename: `${ws.id}.csv`,
      };
    }

    // HTML format
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Investigation Report: ${ws.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 30px; }
    h1 { color: #00f0ff; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    th { color: #94a3b8; font-size: 0.85rem; }
  </style>
</head>
<body>
  <h1>${ws.title}</h1>
  <p>${ws.description || 'Investigation Report'}</p>
  <div class="card">
    <h3>Pinned Items (${ws.items.length})</h3>
    <ul>${ws.items.map((i) => `<li>[${i.type.toUpperCase()}] ${i.title} - ${i.timestamp}</li>`).join('')}</ul>
  </div>
  <div class="card">
    <h3>Investigation Notes (${ws.notes.length})</h3>
    <ul>${ws.notes.map((n) => `<li>${n.text} (<em>${n.timestamp}</em>)</li>`).join('')}</ul>
  </div>
  <div class="card">
    <h3>Unified Timeline (${ws.timeline.length})</h3>
    <table>
      <tr><th>Timestamp</th><th>Event</th><th>Description</th></tr>
      ${ws.timeline.map((t) => `<tr><td>${t.timestamp}</td><td>${t.eventType}</td><td>${t.description}</td></tr>`).join('')}
    </table>
  </div>
</body>
</html>`;

    return {
      content: html,
      mimeType: 'text/html',
      filename: `${ws.id}.html`,
    };
  }
}

export const investigationService = new InvestigationService();
