// AgentLens Control Center — Client State & Native Bridge Controller
(function() {
  'use strict';

  // State
  const state = {
    isRunning: false,
    isStarting: false,
    backendPort: 43121,
    frontendPort: 5174,
    backendPid: null,
    frontendPid: null,
    backendHealth: 'Offline',
    frontendHealth: 'Offline',
    activeFilter: 'all',
    autoScroll: true,
    logs: [],
    startTime: null,
    uptimeTimer: null,
  };

  // DOM Elements
  const el = {
    btnStartStop: document.getElementById('btnStartStop'),
    startStopText: document.getElementById('startStopText'),
    startIcon: document.getElementById('startIcon'),
    stopIcon: document.getElementById('stopIcon'),
    btnRestart: document.getElementById('btnRestart'),
    btnOpenBrowser: document.getElementById('btnOpenBrowser'),
    globalStatusPill: document.getElementById('globalStatusPill'),
    globalStatusText: document.getElementById('globalStatusText'),
    
    // Cards
    cardBackend: document.getElementById('cardBackend'),
    cardFrontend: document.getElementById('cardFrontend'),
    backendState: document.getElementById('backendState'),
    frontendState: document.getElementById('frontendState'),
    backendEndpoint: document.getElementById('backendEndpoint'),
    frontendEndpoint: document.getElementById('frontendEndpoint'),
    backendPid: document.getElementById('backendPid'),
    frontendPid: document.getElementById('frontendPid'),
    backendHealth: document.getElementById('backendHealth'),
    frontendHealth: document.getElementById('frontendHealth'),
    backendUptime: document.getElementById('backendUptime'),
    frontendMode: document.getElementById('frontendMode'),
    
    // System card
    sysSecMode: document.getElementById('sysSecMode'),
    sysNodeVer: document.getElementById('sysNodeVer'),
    btnQuickFreePorts: document.getElementById('btnQuickFreePorts'),
    linkOpenLogs: document.getElementById('linkOpenLogs'),
    linkOpenData: document.getElementById('linkOpenData'),
    linkFooterDash: document.getElementById('linkFooterDash'),

    // Terminal
    terminal: document.getElementById('terminal'),
    terminalLines: document.getElementById('terminalLines'),
    autoScrollCheck: document.getElementById('autoScrollCheck'),
    btnClearLogs: document.getElementById('btnClearLogs'),
    btnCopyLogs: document.getElementById('btnCopyLogs'),
    logChips: document.querySelectorAll('.chip[data-filter]'),
    tabBtns: document.querySelectorAll('.tab-btn[data-tab]'),
    tabPanes: document.querySelectorAll('.tab-pane'),

    // Diagnostics
    btnRunDiagnostics: document.getElementById('btnRunDiagnostics'),
    diagTableBody: document.getElementById('diagTableBody'),

    // Settings Form
    settingsForm: document.getElementById('settingsForm'),
    setBackendPort: document.getElementById('setBackendPort'),
    setFrontendPort: document.getElementById('setFrontendPort'),
    setExecutionMode: document.getElementById('setExecutionMode'),
    setAutoOpen: document.getElementById('setAutoOpen'),
    setDryRun: document.getElementById('setDryRun'),
    setLlmEnabled: document.getElementById('setLlmEnabled'),
    btnResetSettings: document.getElementById('btnResetSettings'),
  };

  // Check Native IPC capability
  const isNative = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeApp;

  function sendNative(action, payload = {}) {
    if (isNative) {
      window.webkit.messageHandlers.nativeApp.postMessage({ action, ...payload });
    } else {
      console.log('[NativeBridge Fallback] Action:', action, payload);
    }
  }

  // UI Event Listeners
  function initEvents() {
    // Start / Stop Toggle
    el.btnStartStop.addEventListener('click', () => {
      if (state.isRunning) {
        stopApp();
      } else {
        startApp();
      }
    });

    // Restart
    el.btnRestart.addEventListener('click', () => {
      restartApp();
    });

    // Open Browser
    el.btnOpenBrowser.addEventListener('click', () => {
      openDashboard();
    });
    el.linkFooterDash.addEventListener('click', (e) => {
      e.preventDefault();
      openDashboard();
    });

    // Quick Free Ports
    el.btnQuickFreePorts.addEventListener('click', () => {
      appendLog('system', 'Attempting to free ports ' + state.backendPort + ' & ' + state.frontendPort + '...');
      sendNative('freePorts', { ports: [state.backendPort, state.frontendPort] });
    });

    // Open Logs / Data
    el.linkOpenLogs.addEventListener('click', (e) => {
      e.preventDefault();
      sendNative('openFolder', { target: 'logs' });
    });
    el.linkOpenData.addEventListener('click', (e) => {
      e.preventDefault();
      sendNative('openFolder', { target: 'data' });
    });

    // Log Controls
    el.autoScrollCheck.addEventListener('change', (e) => {
      state.autoScroll = e.target.checked;
    });

    el.btnClearLogs.addEventListener('click', () => {
      el.terminalLines.innerHTML = '';
      state.logs = [];
      appendLog('system', 'Console cleared.');
    });

    el.btnCopyLogs.addEventListener('click', () => {
      const allText = state.logs.map(l => `[${l.time}] [${l.source.toUpperCase()}] ${l.text}`).join('\n');
      navigator.clipboard.writeText(allText).then(() => {
        const originalText = el.btnCopyLogs.innerText;
        el.btnCopyLogs.innerText = 'Copied!';
        setTimeout(() => el.btnCopyLogs.innerText = originalText, 1500);
      });
    });

    // Log Filters
    el.logChips.forEach(chip => {
      chip.addEventListener('click', () => {
        el.logChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.activeFilter = chip.getAttribute('data-filter');
        filterLogs();
      });
    });

    // Tabs
    el.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        el.tabBtns.forEach(b => b.classList.remove('active'));
        el.tabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`pane${capitalize(tab)}`).classList.add('active');
      });
    });

    // Diagnostics Re-run
    el.btnRunDiagnostics.addEventListener('click', () => {
      runDiagnostics();
    });

    // Settings Submit
    el.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveSettings();
    });

    el.btnResetSettings.addEventListener('click', () => {
      el.setBackendPort.value = '43121';
      el.setFrontendPort.value = '5174';
      el.setExecutionMode.value = 'development';
      el.setAutoOpen.value = 'true';
      el.setDryRun.value = 'true';
      el.setLlmEnabled.value = 'false';
    });
  }

  function startApp() {
    state.isStarting = true;
    updateGlobalStatus('starting', 'Starting AgentLens...');
    el.btnStartStop.disabled = true;
    
    appendLog('system', 'Starting AgentLens services (Mode: ' + el.setExecutionMode.value + ')...');
    
    sendNative('startServers', {
      mode: el.setExecutionMode.value,
      backendPort: parseInt(el.setBackendPort.value, 10),
      frontendPort: parseInt(el.setFrontendPort.value, 10),
      autoOpen: el.setAutoOpen.value === 'true'
    });
  }

  function stopApp() {
    updateGlobalStatus('stopping', 'Stopping services...');
    el.btnStartStop.disabled = true;
    appendLog('system', 'Stopping all active processes...');
    sendNative('stopServers');
  }

  function restartApp() {
    updateGlobalStatus('starting', 'Restarting...');
    appendLog('system', 'Restarting AgentLens...');
    sendNative('restartServers', {
      mode: el.setExecutionMode.value,
      backendPort: parseInt(el.setBackendPort.value, 10),
      frontendPort: parseInt(el.setFrontendPort.value, 10),
      autoOpen: false
    });
  }

  function openDashboard() {
    const url = `http://127.0.0.1:${state.frontendPort}`;
    sendNative('openBrowser', { url });
  }

  function runDiagnostics() {
    el.diagTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:18px; color:var(--text-muted);">Running pre-flight checks...</td></tr>';
    sendNative('runDiagnostics');
  }

  function saveSettings() {
    const config = {
      PORT: el.setBackendPort.value,
      FRONTEND_PORT: el.setFrontendPort.value,
      MODE: el.setExecutionMode.value,
      AUTO_OPEN: el.setAutoOpen.value,
      ENABLE_DRY_RUN_MODE: el.setDryRun.value,
      LLM_ENABLED: el.setLlmEnabled.value,
    };
    sendNative('saveSettings', config);
    appendLog('system', 'Configuration settings saved.');
  }

  function updateGlobalStatus(status, label) {
    el.globalStatusPill.className = 'global-status-pill ' + status;
    el.globalStatusText.innerText = label;

    if (status === 'running') {
      state.isRunning = true;
      state.isStarting = false;
      el.btnStartStop.disabled = false;
      el.btnStartStop.className = 'btn btn-primary btn-stop';
      el.startStopText.innerText = 'Stop AgentLens';
      el.startIcon.classList.add('hidden');
      el.stopIcon.classList.remove('hidden');
      el.btnRestart.disabled = false;
      el.btnOpenBrowser.disabled = false;
      
      if (!state.uptimeTimer) {
        state.startTime = Date.now();
        state.uptimeTimer = setInterval(updateUptime, 1000);
      }
    } else if (status === 'stopped') {
      state.isRunning = false;
      state.isStarting = false;
      el.btnStartStop.disabled = false;
      el.btnStartStop.className = 'btn btn-primary';
      el.startStopText.innerText = 'Start AgentLens';
      el.startIcon.classList.remove('hidden');
      el.stopIcon.classList.add('hidden');
      el.btnRestart.disabled = true;
      el.btnOpenBrowser.disabled = true;
      
      clearInterval(state.uptimeTimer);
      state.uptimeTimer = null;
      el.backendUptime.innerText = '—';
    } else if (status === 'starting' || status === 'stopping') {
      el.btnStartStop.disabled = true;
      el.btnRestart.disabled = true;
    }
  }

  function updateUptime() {
    if (!state.startTime || !state.isRunning) return;
    const diffSec = Math.floor((Date.now() - state.startTime) / 1000);
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    el.backendUptime.innerText = `${m}m ${s < 10 ? '0' : ''}${s}s`;
  }

  function appendLog(source, text, isError = false) {
    const timeStr = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logItem = { time: timeStr, source, text, isError };
    state.logs.push(logItem);

    const row = document.createElement('div');
    row.className = `log-entry log-${source} ${isError ? 'log-error' : ''}`;
    row.setAttribute('data-source', source);

    let badgeClass = source;
    if (isError) badgeClass = 'error';

    row.innerHTML = `
      <span class="log-time">[${timeStr}]</span>
      <span class="log-badge ${badgeClass}">${source.toUpperCase()}</span>
      <span class="log-msg">${escapeHtml(text)}</span>
    `;

    if (state.activeFilter !== 'all' && state.activeFilter !== source) {
      row.style.display = 'none';
    }

    el.terminalLines.appendChild(row);

    if (state.autoScroll) {
      el.terminal.scrollTop = el.terminal.scrollHeight;
    }
  }

  function filterLogs() {
    const entries = el.terminalLines.querySelectorAll('.log-entry');
    entries.forEach(entry => {
      const src = entry.getAttribute('data-source');
      if (state.activeFilter === 'all' || state.activeFilter === src) {
        entry.style.display = 'flex';
      } else {
        entry.style.display = 'none';
      }
    });
    if (state.autoScroll) {
      el.terminal.scrollTop = el.terminal.scrollHeight;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ================= Exposed Native Callbacks =================
  window.onLog = function(source, text, isError) {
    appendLog(source, text, isError);
  };

  window.onStatusUpdate = function(data) {
    // data: { backendRunning, frontendRunning, backendPid, frontendPid, backendPort, frontendPort, backendHealth, frontendHealth, nodeVer }
    state.backendPort = data.backendPort || state.backendPort;
    state.frontendPort = data.frontendPort || state.frontendPort;
    
    el.backendEndpoint.innerText = `http://127.0.0.1:${state.backendPort}`;
    el.frontendEndpoint.innerText = `http://127.0.0.1:${state.frontendPort}`;
    el.linkFooterDash.innerText = `http://127.0.0.1:${state.frontendPort}`;

    // Backend state
    if (data.backendRunning) {
      el.cardBackend.className = 'service-card running';
      el.backendState.innerHTML = '<span class="indicator-dot"></span><span class="indicator-text">Online</span>';
      el.backendPid.innerText = data.backendPid || '—';
      el.backendHealth.innerHTML = '<span class="badge-pass">✓ HTTP 200 OK</span>';
    } else {
      el.cardBackend.className = 'service-card';
      el.backendState.innerHTML = '<span class="indicator-dot"></span><span class="indicator-text">Offline</span>';
      el.backendPid.innerText = '—';
      el.backendHealth.innerText = '—';
    }

    // Frontend state
    if (data.frontendRunning) {
      el.cardFrontend.className = 'service-card running';
      el.frontendState.innerHTML = '<span class="indicator-dot"></span><span class="indicator-text">Online</span>';
      el.frontendPid.innerText = data.frontendPid || '—';
      el.frontendHealth.innerHTML = '<span class="badge-pass">✓ Ready</span>';
    } else {
      el.cardFrontend.className = 'service-card';
      el.frontendState.innerHTML = '<span class="indicator-dot"></span><span class="indicator-text">Offline</span>';
      el.frontendPid.innerText = '—';
      el.frontendHealth.innerText = '—';
    }

    if (data.nodeVer) {
      el.sysNodeVer.innerText = data.nodeVer;
    }

    if (data.backendRunning && data.frontendRunning) {
      updateGlobalStatus('running', 'Running');
    } else if (!data.backendRunning && !data.frontendRunning) {
      updateGlobalStatus('stopped', 'Stopped');
    }
  };

  window.onDiagnosticsResult = function(results) {
    // results: [ { name, required, detected, pass, statusText } ]
    el.diagTableBody.innerHTML = '';
    results.forEach(res => {
      const tr = document.createElement('tr');
      const badge = res.pass 
        ? `<span class="badge-pass">✓ ${res.statusText || 'Pass'}</span>`
        : `<span class="badge-fail">✕ ${res.statusText || 'Failed'}</span>`;
      
      tr.innerHTML = `
        <td><strong>${escapeHtml(res.name)}</strong></td>
        <td><span class="mono">${escapeHtml(res.required)}</span></td>
        <td><span class="mono">${escapeHtml(res.detected)}</span></td>
        <td>${badge}</td>
      `;
      el.diagTableBody.appendChild(tr);
    });
  };

  window.onSettingsLoaded = function(config) {
    if (config.PORT) el.setBackendPort.value = config.PORT;
    if (config.FRONTEND_PORT) el.setFrontendPort.value = config.FRONTEND_PORT;
    if (config.ENABLE_DRY_RUN_MODE) {
      el.setDryRun.value = config.ENABLE_DRY_RUN_MODE === 'true' ? 'true' : 'false';
      el.sysSecMode.innerText = config.ENABLE_DRY_RUN_MODE === 'true' 
        ? 'Dry-Run Simulation (Safe)' 
        : 'Live Execution Mode';
    }
    if (config.LLM_ENABLED) el.setLlmEnabled.value = config.LLM_ENABLED === 'true' ? 'true' : 'false';
  };

  // Keyboard shortcut: Cmd+R
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
      e.preventDefault();
      if (state.isRunning) restartApp();
    }
  });

  // Initialization
  initEvents();
  sendNative('init');
  setTimeout(() => {
    sendNative('runDiagnostics');
    sendNative('checkStatus');
  }, 400);

})();
