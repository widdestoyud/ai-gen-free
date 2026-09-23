export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Telemetry & Redis Observability Dashboard | ai-gen-free</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-main: #0b0f19;
      --bg-card: #111827;
      --bg-hover: #1f2937;
      --bg-accent: #1e293b;
      --border-color: #2d3748;
      --border-active: #3b82f6;
      --text-main: #f3f4f6;
      --text-dim: #9ca3af;
      --text-muted: #6b7280;
      --color-info: #3b82f6;
      --color-warn: #f59e0b;
      --color-error: #ef4444;
      --color-debug: #8b5cf6;
      --color-success: #10b981;
      --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
      --font-mono: 'Fira Code', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-main);
      color: var(--text-main);
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Top Navigation */
    header {
      background-color: #0f172a;
      border-bottom: 1px solid var(--border-color);
      padding: 10px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 34px;
      height: 34px;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: white;
      font-size: 18px;
    }
    .brand-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #fff;
    }
    .brand-subtitle {
      font-size: 11px;
      color: var(--text-dim);
      font-family: var(--font-mono);
    }

    /* Navigation Tabs */
    .nav-tabs {
      display: flex;
      align-items: center;
      gap: 6px;
      background-color: #0b0f19;
      padding: 4px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }
    .nav-tab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 6px;
      background: transparent;
      border: none;
      color: var(--text-dim);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .nav-tab:hover {
      color: #fff;
      background-color: rgba(255, 255, 255, 0.05);
    }
    .nav-tab.active {
      color: #fff;
      background-color: #1e293b;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .nav-badge {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 9999px;
      background-color: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      font-family: var(--font-mono);
    }
    .nav-badge.online {
      background-color: rgba(16, 185, 129, 0.2);
      color: #34d399;
    }
    .nav-badge.offline {
      background-color: rgba(239, 68, 68, 0.2);
      color: #f87171;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .badge-online {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background-color: rgba(16, 185, 129, 0.15);
      color: #10b981;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #10b981;
      box-shadow: 0 0 8px #10b981;
    }

    /* Main Container */
    main {
      flex: 1;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 1600px;
      margin: 0 auto;
      width: 100%;
    }

    .tab-view {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
    }

    /* Control Panel / Search Bar (Splunk style) */
    .control-panel {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }

    .search-row {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .search-input-wrapper {
      flex: 1;
      position: relative;
    }
    .search-input {
      width: 100%;
      background-color: #0b0f19;
      border: 1px solid var(--border-color);
      color: #fff;
      font-family: var(--font-mono);
      font-size: 13px;
      padding: 10px 14px 10px 38px;
      border-radius: 6px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-input:focus {
      border-color: var(--border-active);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-dim);
      pointer-events: none;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 16px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      user-select: none;
    }
    .btn-primary {
      background-color: #2563eb;
      color: #fff;
    }
    .btn-primary:hover {
      background-color: #1d4ed8;
    }
    .btn-secondary {
      background-color: var(--bg-hover);
      color: var(--text-main);
      border-color: var(--border-color);
    }
    .btn-secondary:hover {
      background-color: #374151;
    }

    /* Filters Row */
    .filters-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .filter-label {
      font-size: 12px;
      color: var(--text-dim);
      font-weight: 500;
    }
    .pill-select, .input-sm {
      background-color: #0b0f19;
      border: 1px solid var(--border-color);
      color: #fff;
      font-size: 12px;
      padding: 6px 10px;
      border-radius: 6px;
      outline: none;
      font-family: inherit;
    }
    .pill-select:focus, .input-sm:focus {
      border-color: var(--border-active);
    }
    .input-sm {
      font-family: var(--font-mono);
      width: 140px;
    }

    .active-trace-bar {
      display: none;
      background-color: #1e1b4b;
      border: 1px solid #4338ca;
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 12px;
      align-items: center;
      justify-content: space-between;
      color: #c7d2fe;
    }
    .trace-pill {
      background-color: #312e81;
      border: 1px solid #6366f1;
      color: #e0e7ff;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
    .metric-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }
    .metric-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .metric-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .metric-icon {
      font-size: 16px;
    }
    .metric-value {
      font-size: 26px;
      font-weight: 700;
      color: #fff;
      font-family: var(--font-mono);
      letter-spacing: -0.02em;
    }
    .metric-subtitle {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
      font-family: var(--font-mono);
    }
    .metric-card.error { border-left: 4px solid var(--color-error); }
    .metric-card.warn  { border-left: 4px solid var(--color-warn); }
    .metric-card.info  { border-left: 4px solid var(--color-info); }
    .metric-card.success { border-left: 4px solid var(--color-success); }

    .progress-bar-bg {
      width: 100%;
      height: 6px;
      background-color: #1f2937;
      border-radius: 999px;
      overflow: hidden;
      margin-top: 10px;
    }
    .progress-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.3s ease;
    }
    .mini-badge {
      display: inline-block;
      font-size: 10px;
      font-family: var(--font-mono);
      background-color: #1f2937;
      color: #9ca3af;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #374151;
    }

    /* Histogram Card */
    .histogram-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .histogram-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .histogram-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .histogram-bars {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      height: 80px;
      padding-top: 10px;
      border-bottom: 1px solid var(--border-color);
    }
    .hist-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      height: 100%;
      position: relative;
      cursor: pointer;
    }
    .hist-col:hover .hist-bar-total {
      filter: brightness(1.2);
    }
    .hist-bar-total {
      background-color: #3b82f6;
      border-radius: 2px 2px 0 0;
      width: 100%;
      min-height: 2px;
      position: relative;
    }
    .hist-bar-error {
      background-color: #ef4444;
      border-radius: 2px 2px 0 0;
      width: 100%;
      min-height: 2px;
    }

    /* Logs Table / Stream */
    .logs-container {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .logs-header {
      padding: 12px 18px;
      background-color: #0f172a;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 600;
    }

    .table-wrapper {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background-color: #111827;
      padding: 10px 14px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border-color);
    }
    td {
      padding: 10px 14px;
      border-bottom: 1px solid #1f2937;
      font-size: 13px;
      vertical-align: top;
    }
    tr.log-row {
      cursor: pointer;
      transition: background-color 0.1s ease;
    }
    tr.log-row:hover {
      background-color: var(--bg-hover);
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      font-family: var(--font-mono);
      letter-spacing: 0.05em;
    }
    .badge-error { background-color: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
    .badge-warn  { background-color: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
    .badge-info  { background-color: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }
    .badge-debug { background-color: rgba(139, 92, 246, 0.2); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.4); }

    .service-badge {
      background-color: #1e293b;
      color: #94a3b8;
      border: 1px solid #334155;
      font-family: var(--font-mono);
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .time-cell {
      font-family: var(--font-mono);
      color: var(--text-dim);
      font-size: 12px;
      white-space: nowrap;
    }

    .message-cell {
      word-break: break-word;
      max-width: 650px;
    }
    .event-name {
      font-family: var(--font-mono);
      font-size: 11px;
      color: #93c5fd;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .correlation-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .corr-badge {
      font-family: var(--font-mono);
      font-size: 10px;
      background-color: #0b0f19;
      border: 1px solid var(--border-color);
      padding: 1px 6px;
      border-radius: 4px;
      color: var(--text-dim);
      cursor: pointer;
    }
    .corr-badge:hover {
      border-color: var(--border-active);
      color: #fff;
    }

    /* Expandable Log Details Drawer */
    tr.detail-row {
      background-color: #080c14;
    }
    .detail-container {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .detail-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .json-box {
      background-color: #050811;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 14px;
      color: #e2e8f0;
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.4;
      max-height: 400px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    /* Pagination */
    .pagination-bar {
      padding: 12px 18px;
      background-color: #0f172a;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      color: var(--text-dim);
    }

    /* REDIS SPECIFIC STYLES */
    .redis-banner {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 14px;
    }
    .redis-banner-left {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .redis-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 700;
      font-family: var(--font-mono);
      padding: 5px 12px;
      border-radius: 9999px;
    }
    .redis-status-pill.online {
      background-color: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    .redis-status-pill.offline {
      background-color: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: currentColor;
      box-shadow: 0 0 10px currentColor;
    }
    .redis-meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }
    .redis-meta-label {
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 600;
    }
    .redis-meta-val {
      font-family: var(--font-mono);
      color: var(--text-main);
    }

    .section-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .section-header {
      padding: 14px 20px;
      background-color: #0f172a;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .section-body {
      padding: 18px 20px;
    }

    /* BullMQ Queue Cards */
    .queues-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    @media (min-width: 1024px) {
      .queues-grid {
        grid-template-columns: 1fr 1fr;
      }
    }
    .queue-card {
      background-color: #0b0f19;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .queue-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .queue-title {
      font-size: 16px;
      font-weight: 700;
      font-family: var(--font-mono);
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .queue-status-tag {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: var(--font-mono);
    }
    .queue-status-tag.running {
      background-color: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    .queue-status-tag.paused {
      background-color: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }

    /* Segmented Progress Bar */
    .seg-bar {
      display: flex;
      height: 12px;
      background-color: #1f2937;
      border-radius: 6px;
      overflow: hidden;
      width: 100%;
    }
    .seg-part {
      height: 100%;
      transition: width 0.3s ease;
    }
    .seg-waiting   { background-color: #3b82f6; }
    .seg-active    { background-color: #f59e0b; }
    .seg-completed { background-color: #10b981; }
    .seg-failed    { background-color: #ef4444; }
    .seg-delayed   { background-color: #8b5cf6; }

    .queue-stat-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .stat-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-family: var(--font-mono);
      background-color: #111827;
      border: 1px solid var(--border-color);
    }
    .stat-pill-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    /* Queue Job Row in Table */
    .job-state-pill {
      font-size: 10px;
      font-weight: 700;
      font-family: var(--font-mono);
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .job-state-active    { background-color: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #f59e0b; }
    .job-state-waiting   { background-color: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid #3b82f6; }
    .job-state-completed { background-color: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981; }
    .job-state-failed    { background-color: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }
    .job-state-delayed   { background-color: rgba(139, 92, 246, 0.2); color: #c084fc; border: 1px solid #8b5cf6; }

    /* Keyspace Tags */
    .keys-category-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .key-cat-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 6px;
      background-color: #0b0f19;
      border: 1px solid var(--border-color);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .key-cat-pill:hover, .key-cat-pill.active {
      border-color: var(--border-active);
      background-color: #1e293b;
    }
    .key-cat-count {
      font-family: var(--font-mono);
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      background-color: #1f2937;
      color: #93c5fd;
    }

    /* Toast Notification */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background-color: #10b981;
      color: #fff;
      padding: 10px 18px;
      border-radius: 6px;
      font-weight: 600;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
      display: none;
      z-index: 999;
    }
  </style>
</head>
<body>

  <header>
    <div class="brand">
      <div class="brand-logo">⚡</div>
      <div>
        <div class="brand-title">Telemetry & Observability</div>
        <div class="brand-subtitle">Splunk-style Tracing & Redis Visualizer</div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <nav class="nav-tabs">
      <button id="tabLogsBtn" class="nav-tab active" onclick="switchTab('logs')">
        <span>📋</span> Logs & Tracing
      </button>
      <button id="tabRedisBtn" class="nav-tab" onclick="switchTab('redis')">
        <span>🔴</span> Redis & BullMQ
        <span id="redisNavBadge" class="nav-badge">Checking...</span>
      </button>
    </nav>

    <div class="header-actions">
      <div id="liveSystemBadge" class="badge-online">
        <div class="badge-dot"></div>
        <span id="liveStatusText">Live System</span>
      </div>
      <div class="filter-group">
        <label class="filter-label">Auto-refresh:</label>
        <select id="autoRefresh" class="pill-select">
          <option value="0" selected>Off</option>
          <option value="5000">5 detik</option>
          <option value="10000">10 detik</option>
          <option value="30000">30 detik</option>
        </select>
      </div>
    </div>
  </header>

  <main>
    <!-- TAB 1: LOGS & TRACING (SPLUNK-STYLE) -->
    <div id="viewLogs" class="tab-view">
      <!-- Search & Control Panel -->
      <div class="control-panel">
        <div class="search-row">
          <div class="search-input-wrapper">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="searchInput" class="search-input" placeholder="Search events, messages, HTTP paths, error codes... (misal: W002, submit, /jobs, seedance)">
          </div>
          <button id="searchBtn" class="btn btn-primary">🔍 Search</button>
          <button id="resetBtn" class="btn btn-secondary">Reset</button>
          <button id="syncLogsBtn" class="btn btn-secondary" onclick="triggerManualLogSync(true)">🔄 Sync Files</button>
          <button id="exportJsonBtn" class="btn btn-secondary">Export JSON</button>
        </div>

        <!-- Tracing inputs & Filters -->
        <div class="filters-row">
          <div class="filter-group">
            <label class="filter-label">Waktu:</label>
            <select id="timeRange" class="pill-select">
              <option value="all">Semua Waktu</option>
              <option value="24h">24 Jam Terakhir</option>
              <option value="7d">7 Hari Terakhir</option>
              <option value="30d">30 Hari Terakhir</option>
              <option value="custom">Rentang Kustom...</option>
            </select>
          </div>

          <div id="customDateRange" style="display: none; align-items: center; gap: 6px;">
            <input type="date" id="startDateInput" class="input-sm" style="width: 130px;">
            <span style="color: var(--text-dim); font-size: 11px;">s/d</span>
            <input type="date" id="endDateInput" class="input-sm" style="width: 130px;">
          </div>

          <div class="filter-group">
            <label class="filter-label">Level:</label>
            <select id="levelSelect" class="pill-select">
              <option value="all">Semua Level</option>
              <option value="error">ERROR</option>
              <option value="warn">WARN</option>
              <option value="info">INFO</option>
              <option value="debug">DEBUG</option>
            </select>
          </div>

          <div class="filter-group">
            <label class="filter-label">Service:</label>
            <select id="serviceSelect" class="pill-select">
              <option value="all">Semua Service</option>
              <option value="siray">Siray</option>
              <option value="worker">Worker</option>
              <option value="api">API</option>
              <option value="storage">Storage</option>
              <option value="web">Web</option>
            </select>
          </div>

          <div class="filter-group">
            <label class="filter-label">Transaction ID:</label>
            <input type="text" id="txInput" class="input-sm" placeholder="tx-...">
          </div>

          <div class="filter-group">
            <label class="filter-label">Job ID:</label>
            <input type="text" id="jobInput" class="input-sm" placeholder="cmu... / cmt...">
          </div>

          <div class="filter-group">
            <label class="filter-label">User ID:</label>
            <input type="text" id="userInput" class="input-sm" placeholder="cmu... / cmt...">
          </div>
        </div>

        <!-- Active Trace Indicator Bar -->
        <div id="activeTraceBar" class="active-trace-bar">
          <span>Active Trace Filter:</span>
          <div id="tracePillsContainer" style="display: flex; gap: 8px;"></div>
        </div>
      </div>

      <!-- Metrics Cards -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-title">Total Logs</div>
          <div class="metric-value" id="metricTotal">0</div>
        </div>
        <div class="metric-card error">
          <div class="metric-title">Errors</div>
          <div class="metric-value" id="metricErrors">0</div>
        </div>
        <div class="metric-card warn">
          <div class="metric-title">Warnings</div>
          <div class="metric-value" id="metricWarnings">0</div>
        </div>
        <div class="metric-card info">
          <div class="metric-title">Info Logs</div>
          <div class="metric-value" id="metricInfos">0</div>
        </div>
      </div>

      <!-- Timeline Histogram -->
      <div class="histogram-card">
        <div class="histogram-header">
          <div class="histogram-title">DISTRIBUSI LOG & VOLUME ERROR SEPANJANG WAKTU</div>
          <div style="font-size: 11px; color: var(--text-dim); display: flex; gap: 12px;">
            <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; background: #3b82f6; border-radius: 2px;"></span> Normal</span>
            <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; background: #ef4444; border-radius: 2px;"></span> Error</span>
          </div>
        </div>
        <div class="histogram-bars" id="histogramBars"></div>
      </div>

      <!-- Logs Table -->
      <div class="logs-container">
        <div class="logs-header">
          <div>DAFTAR EVENT TELEMETRY (<span id="showingCount">0</span> DITEMUKAN)</div>
          <div style="font-size: 11px; color: var(--text-dim);">Klik baris untuk melihat raw JSON & stack trace</div>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style="width: 40px;"></th>
                <th style="width: 170px;">Timestamp</th>
                <th style="width: 80px;">Level</th>
                <th style="width: 90px;">Service</th>
                <th>Pesan & Konteks Alur</th>
                <th style="width: 110px;">HTTP / Status</th>
              </tr>
            </thead>
            <tbody id="logsTableBody">
              <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-dim);">
                  Memuat data log telemetry...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination-bar">
          <div id="paginationInfo">Menampilkan 0-0</div>
          <div style="display: flex; gap: 8px;">
            <button id="prevBtn" class="btn btn-secondary" style="padding: 4px 10px; font-size: 12px;" disabled>← Sebelumnya</button>
            <button id="nextBtn" class="btn btn-secondary" style="padding: 4px 10px; font-size: 12px;" disabled>Berikutnya →</button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: REDIS & BULLMQ MONITOR -->
    <div id="viewRedis" class="tab-view" style="display: none;">
      <!-- Redis Top Connection Banner -->
      <div class="redis-banner">
        <div class="redis-banner-left">
          <div id="redisStatusIndicator" class="redis-status-pill online">
            <span class="pulse-dot"></span>
            <span id="redisStatusText">REDIS CONNECTED</span>
          </div>
          <div class="redis-meta-item">
            <span class="redis-meta-label">ENDPOINT:</span>
            <span id="redisMetaUrl" class="redis-meta-val">redis://127.0.0.1:6379</span>
          </div>
          <div class="redis-meta-item">
            <span class="redis-meta-label">VERSION:</span>
            <span id="redisMetaVersion" class="redis-meta-val">--</span>
          </div>
          <div class="redis-meta-item">
            <span class="redis-meta-label">UPTIME:</span>
            <span id="redisMetaUptime" class="redis-meta-val">--</span>
          </div>
          <div class="redis-meta-item">
            <span class="redis-meta-label">PID:</span>
            <span id="redisMetaPid" class="redis-meta-val">--</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span id="redisLastUpdated" style="font-size: 11px; color: var(--text-dim); font-family: var(--font-mono);"></span>
          <button class="btn btn-secondary" onclick="loadRedisData(true)" style="padding: 6px 12px; font-size: 12px;">
            🔄 Refresh Redis
          </button>
        </div>
      </div>

      <!-- Circuit Breaker Status Banner -->
      <div class="redis-banner" style="margin-top: 14px; border-left: 4px solid var(--accent-color);">
        <div class="redis-banner-left">
          <div style="font-weight: 700; font-size: 13px; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            🛡️ GPU PROVIDER CIRCUIT BREAKER (Siray)
          </div>
          <div id="cbStatusPill" class="redis-status-pill online">
            <span class="pulse-dot"></span>
            <span id="cbStatusText">STATE: CLOSED (HEALTHY)</span>
          </div>
          <div class="redis-meta-item">
            <span class="redis-meta-label">CONSECUTIVE TIMEOUTS:</span>
            <span id="cbFailures" class="redis-meta-val">0 / 3</span>
          </div>
          <div class="redis-meta-item">
            <span class="redis-meta-label">COOLDOWN MODE:</span>
            <span id="cbCooldown" class="redis-meta-val">90s</span>
          </div>
          <div class="redis-meta-item">
            <span class="redis-meta-label">LAST EVENT:</span>
            <span id="cbLastReason" class="redis-meta-val" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">None</span>
          </div>
        </div>
        <div>
          <button class="btn btn-secondary" onclick="resetCircuitBreaker()" style="padding: 5px 12px; font-size: 11px;">
            🔄 Reset Breaker
          </button>
        </div>
      </div>

      <!-- 4 KPI Cards for Redis -->
      <div class="metrics-grid">
        <!-- Card 1: Memory -->
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Used Memory</span>
            <span class="metric-icon">💾</span>
          </div>
          <div id="redisMetricMemory" class="metric-value" style="color: #60a5fa;">0 B</div>
          <div id="redisMemorySub" class="metric-subtitle">Peak: -- | RSS: --</div>
          <div class="progress-bar-bg">
            <div id="redisMemoryBar" class="progress-fill" style="width: 0%; background: linear-gradient(90deg, #3b82f6, #8b5cf6);"></div>
          </div>
          <div style="margin-top: 8px; display: flex; gap: 6px;">
            <span id="redisFragBadge" class="mini-badge">Frag: --</span>
            <span id="redisPolicyBadge" class="mini-badge">Policy: --</span>
          </div>
        </div>

        <!-- Card 2: Ops & Clients -->
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Throughput & Clients</span>
            <span class="metric-icon">⚡</span>
          </div>
          <div id="redisMetricOps" class="metric-value" style="color: #34d399;">0 ops/s</div>
          <div id="redisOpsSub" class="metric-subtitle">Total: -- commands</div>
          <div style="margin-top: 14px; display: flex; gap: 6px;">
            <span id="redisClientsBadge" class="mini-badge">Clients: --</span>
            <span id="redisBlockedBadge" class="mini-badge">Blocked: 0</span>
          </div>
        </div>

        <!-- Card 3: Cache Hit Ratio -->
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">Keyspace Hit Ratio</span>
            <span class="metric-icon">🎯</span>
          </div>
          <div id="redisMetricHitRatio" class="metric-value" style="color: #fbbf24;">0%</div>
          <div id="redisHitSub" class="metric-subtitle">Hits: 0 | Misses: 0</div>
          <div class="progress-bar-bg">
            <div id="redisHitBar" class="progress-fill" style="width: 0%; background: linear-gradient(90deg, #10b981, #f59e0b);"></div>
          </div>
        </div>

        <!-- Card 4: BullMQ Queues Active -->
        <div class="metric-card">
          <div class="metric-header">
            <span class="metric-title">BullMQ Pipeline</span>
            <span class="metric-icon">📬</span>
          </div>
          <div id="bullMetricTotal" class="metric-value" style="color: #a78bfa;">0 Jobs</div>
          <div id="bullMetricSub" class="metric-subtitle">Waiting: 0 | Active: 0</div>
          <div style="margin-top: 14px; display: flex; gap: 6px;">
            <span id="bullGenerateBadge" class="mini-badge">generate: 0</span>
            <span id="bullRetentionBadge" class="mini-badge">retention: 0</span>
          </div>
        </div>
      </div>

      <!-- BullMQ Queues Section -->
      <div class="section-card">
        <div class="section-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">⚡</span>
            <span style="font-weight: 700; font-size: 15px;">BullMQ Job Queues Visualizer</span>
          </div>
          <div style="font-size: 12px; color: var(--text-dim);">
            Generasi gambar &amp; video ('generate') | Pembersihan file kedaluwarsa ('retention')
          </div>
        </div>
        <div class="section-body">
          <div id="bullQueuesContainer" class="queues-grid">
            <!-- Rendered by JS -->
          </div>
        </div>
      </div>

      <!-- Keyspace Explorer Section -->
      <div class="section-card">
        <div class="section-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🔑</span>
            <span style="font-weight: 700; font-size: 15px;">Redis Keyspace & Category Distribution</span>
          </div>
          <div id="keyspaceSampleCount" style="font-size: 12px; color: var(--text-dim); font-family: var(--font-mono);">
            Sampled 0 keys
          </div>
        </div>
        <div class="section-body">
          <!-- Category breakdown tags -->
          <div id="keysCategoryRow" class="keys-category-row">
            <!-- Rendered by JS -->
          </div>

          <!-- Filter sample keys -->
          <div style="margin-top: 16px; display: flex; gap: 12px; align-items: center;">
            <input type="text" id="keysFilterInput" class="search-input" placeholder="Filter nama key... (misal: bull, session, generate, 6379)" style="max-width: 400px; padding: 6px 12px;">
            <span id="keysShowingCount" style="font-size: 11px; color: var(--text-dim); font-family: var(--font-mono);"></span>
          </div>

          <!-- Keys Table -->
          <div class="table-wrapper" style="margin-top: 12px; max-height: 420px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px;">
            <table>
              <thead>
                <tr>
                  <th>Key Name</th>
                  <th style="width: 180px;">Category</th>
                  <th style="width: 100px;">Type</th>
                  <th style="width: 120px;">TTL</th>
                </tr>
              </thead>
              <tbody id="keysTableBody">
                <tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--text-dim);">Memuat data keyspace...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </main>

  <div id="toast" class="toast">JSON disalin ke clipboard!</div>

  <script>
    let activeTab = 'logs';

    let state = {
      q: '',
      timeRange: 'all',
      startDate: '',
      endDate: '',
      level: 'all',
      service: 'all',
      transactionId: '',
      jobId: '',
      userId: '',
      page: 1,
      limit: 30,
      total: 0,
      logs: [],
      refreshTimer: null,
    };

    let redisState = {
      server: null,
      queues: [],
      keyspace: null,
      keysFilter: '',
      selectedCategory: 'all',
    };

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 2500);
    }

    // Switch between Logs and Redis tabs
    function switchTab(tab) {
      activeTab = tab;
      const tabLogsBtn = document.getElementById('tabLogsBtn');
      const tabRedisBtn = document.getElementById('tabRedisBtn');
      const viewLogs = document.getElementById('viewLogs');
      const viewRedis = document.getElementById('viewRedis');

      if (tab === 'logs') {
        tabLogsBtn.classList.add('active');
        tabRedisBtn.classList.remove('active');
        viewLogs.style.display = 'flex';
        viewRedis.style.display = 'none';
        loadLogs();
      } else {
        tabLogsBtn.classList.remove('active');
        tabRedisBtn.classList.add('active');
        viewLogs.style.display = 'none';
        viewRedis.style.display = 'flex';
        loadRedisData();
      }
    }

    // LOGS & TRACING LOGIC
    async function fetchStats() {
      try {
        const p = new URLSearchParams();
        if (state.q) p.set('q', state.q);
        if (state.timeRange !== 'all') p.set('timeRange', state.timeRange);
        if (state.startDate) p.set('startDate', state.startDate);
        if (state.endDate) p.set('endDate', state.endDate);
        if (state.level !== 'all') p.set('level', state.level);
        if (state.service !== 'all') p.set('service', state.service);
        if (state.transactionId) p.set('transactionId', state.transactionId);
        if (state.jobId) p.set('jobId', state.jobId);
        if (state.userId) p.set('userId', state.userId);

        const res = await fetch('/api/stats?' + p.toString());
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById('metricTotal').innerText = data.total.toLocaleString();
        document.getElementById('metricErrors').innerText = data.errors.toLocaleString();
        document.getElementById('metricWarnings').innerText = data.warnings.toLocaleString();
        document.getElementById('metricInfos').innerText = data.infos.toLocaleString();

        renderHistogram(data.timeline || []);
      } catch (err) {
        console.error('Failed to load stats', err);
      }
    }

    function renderHistogram(timeline) {
      const container = document.getElementById('histogramBars');
      container.innerHTML = '';
      if (timeline.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 11px; margin: auto;">Tidak ada data histogram pada rentang waktu ini</div>';
        return;
      }

      const maxCount = Math.max(...timeline.map(t => t.total), 1);

      timeline.forEach(item => {
        const col = document.createElement('div');
        col.className = 'hist-col';
        col.title = \`\${item.date}: \${item.total} logs (\${item.errors} errors)\`;

        const heightPct = Math.max(6, Math.min(100, Math.round((item.total / maxCount) * 100)));
        const errorPct = item.total > 0 ? (item.errors / item.total) * 100 : 0;

        col.innerHTML = \`
          <div class="hist-bar-total" style="height: \${heightPct}%;">
            \${item.errors > 0 ? \`<div class="hist-bar-error" style="height: \${errorPct}%;"></div>\` : ''}
          </div>
        \`;
        container.appendChild(col);
      });
    }

    function renderActiveTrace() {
      const bar = document.getElementById('activeTraceBar');
      const container = document.getElementById('tracePillsContainer');
      container.innerHTML = '';

      let hasTrace = false;
      if (state.transactionId) {
        hasTrace = true;
        const p = document.createElement('span');
        p.className = 'trace-pill';
        p.innerHTML = \`tx: \${state.transactionId} <span style="cursor:pointer;" onclick="clearTrace('tx')">✕</span>\`;
        container.appendChild(p);
      }
      if (state.jobId) {
        hasTrace = true;
        const p = document.createElement('span');
        p.className = 'trace-pill';
        p.innerHTML = \`job: \${state.jobId} <span style="cursor:pointer;" onclick="clearTrace('job')">✕</span>\`;
        container.appendChild(p);
      }
      if (state.userId) {
        hasTrace = true;
        const p = document.createElement('span');
        p.className = 'trace-pill';
        p.innerHTML = \`user: \${state.userId} <span style="cursor:pointer;" onclick="clearTrace('user')">✕</span>\`;
        container.appendChild(p);
      }

      bar.style.display = hasTrace ? 'flex' : 'none';
    }

    window.clearTrace = function(type) {
      if (type === 'tx') { state.transactionId = ''; document.getElementById('txInput').value = ''; }
      if (type === 'job') { state.jobId = ''; document.getElementById('jobInput').value = ''; }
      if (type === 'user') { state.userId = ''; document.getElementById('userInput').value = ''; }
      state.page = 1;
      loadData();
    };

    window.filterBy = function(type, val) {
      if (type === 'tx') { state.transactionId = val; document.getElementById('txInput').value = val; }
      if (type === 'job') { state.jobId = val; document.getElementById('jobInput').value = val; }
      if (type === 'user') { state.userId = val; document.getElementById('userInput').value = val; }
      state.page = 1;
      loadData();
    };

    async function loadLogs() {
      try {
        const p = new URLSearchParams();
        if (state.q) p.set('q', state.q);
        if (state.timeRange !== 'all') p.set('timeRange', state.timeRange);
        if (state.startDate) p.set('startDate', state.startDate);
        if (state.endDate) p.set('endDate', state.endDate);
        if (state.level !== 'all') p.set('level', state.level);
        if (state.service !== 'all') p.set('service', state.service);
        if (state.transactionId) p.set('transactionId', state.transactionId);
        if (state.jobId) p.set('jobId', state.jobId);
        if (state.userId) p.set('userId', state.userId);
        p.set('page', String(state.page));
        p.set('limit', String(state.limit));

        const res = await fetch('/api/logs?' + p.toString());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        state.logs = data.logs || [];
        state.total = data.total || 0;

        document.getElementById('showingCount').innerText = state.total.toLocaleString();
        const start = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;
        const end = Math.min(state.page * state.limit, state.total);
        document.getElementById('paginationInfo').innerText = \`Menampilkan \${start}-\${end} dari \${state.total.toLocaleString()} log\`;

        document.getElementById('prevBtn').disabled = state.page <= 1;
        document.getElementById('nextBtn').disabled = state.page * state.limit >= state.total;

        renderLogsTable(state.logs);
      } catch (err) {
        console.error('Failed to load logs', err);
        document.getElementById('logsTableBody').innerHTML = \`
          <tr><td colspan="6" style="text-align: center; color: var(--color-error); padding: 30px;">
            Gagal memuat log: \${err.message}
          </td></tr>
        \`;
      }
    }

    function renderLogsTable(logs) {
      const tbody = document.getElementById('logsTableBody');
      tbody.innerHTML = '';

      if (logs.length === 0) {
        tbody.innerHTML = \`
          <tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-dim);">
            Tidak ada log yang sesuai dengan filter pencarian.
          </td></tr>
        \`;
        return;
      }

      logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = 'log-row';
        tr.id = \`log-row-\${log.id}\`;

        const levelBadgeClass = \`badge-\${log.level.toLowerCase()}\`;
        const timeStr = log.timestamp ? log.timestamp.replace('T', ' ').slice(0, 19) : '--';

        const hasDetails = log.context || log.error || log.transactionId || log.jobId;

        tr.innerHTML = \`
          <td style="text-align: center; color: var(--text-muted);">
            <span id="chevron-\${log.id}">▶</span>
          </td>
          <td class="time-cell">\${timeStr}</td>
          <td><span class="badge \${levelBadgeClass}">\${log.level}</span></td>
          <td><span class="service-badge">\${log.service}</span></td>
          <td class="message-cell">
            <div class="event-name">\${log.event}</div>
            <div>\${escapeHtml(log.message)}</div>
            <div class="correlation-badges">
              \${log.transactionId ? \`<span class="corr-badge" onclick="event.stopPropagation(); filterBy('tx', '\${escapeAttr(log.transactionId)}')">tx: \${escapeHtml(log.transactionId.slice(0, 16))}...</span>\` : ''}
              \${log.jobId ? \`<span class="corr-badge" onclick="event.stopPropagation(); filterBy('job', '\${escapeAttr(log.jobId)}')">job: \${escapeHtml(log.jobId.slice(0, 16))}...</span>\` : ''}
              \${log.userId ? \`<span class="corr-badge" onclick="event.stopPropagation(); filterBy('user', '\${escapeAttr(log.userId)}')">user: \${escapeHtml(log.userId.slice(0, 16))}...</span>\` : ''}
            </div>
          </td>
          <td class="time-cell">
            \${log.httpMethod ? \`<span style="font-weight: 600; color: #93c5fd;">\${log.httpMethod}</span>\` : ''}
            \${log.httpStatus ? \`<span style="color: \${log.httpStatus >= 400 ? '#f87171' : '#34d399'};"> \${log.httpStatus}</span>\` : ''}
            \${log.durationMs ? \`<div style="font-size: 10px; color: var(--text-muted);">\${log.durationMs}ms</div>\` : ''}
          </td>
        \`;

        // Detail expansion row
        const detailTr = document.createElement('tr');
        detailTr.className = 'detail-row';
        detailTr.id = \`detail-row-\${log.id}\`;
        detailTr.style.display = 'none';

        detailTr.innerHTML = \`
          <td colspan="6">
            <div class="detail-container">
              <div class="detail-top">
                <div style="font-family: var(--font-mono); font-size: 12px; color: #93c5fd;">
                  RAW LOG OBJECT (ID: \${log.id})
                </div>
                <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="copyLogJson('\${log.id}')">
                  📋 Copy JSON
                </button>
              </div>
              <pre class="json-box" id="json-\${log.id}">\${escapeHtml(JSON.stringify(log, null, 2))}</pre>
            </div>
          </td>
        \`;

        tr.onclick = () => {
          const isOpen = detailTr.style.display === 'table-row';
          detailTr.style.display = isOpen ? 'none' : 'table-row';
          document.getElementById(\`chevron-\${log.id}\`).innerText = isOpen ? '▶' : '▼';
        };

        tbody.appendChild(tr);
        tbody.appendChild(detailTr);
      });
    }

    window.copyLogJson = function(id) {
      const el = document.getElementById('json-' + id);
      if (!el) return;
      navigator.clipboard.writeText(el.innerText).then(() => {
        showToast('JSON disalin ke clipboard!');
      });
    };

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
    function escapeAttr(str) {
      if (!str) return '';
      return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    window.triggerManualLogSync = async function(showToastMsg = true) {
      const btn = document.getElementById('syncLogsBtn');
      if (btn) {
        btn.disabled = true;
        btn.innerText = 'Syncing...';
      }
      try {
        const res = await fetch('/api/logs/sync', { method: 'POST' });
        const data = await res.json();
        if (showToastMsg) {
          showToast('File logs disinkronkan (' + (data.newEntriesCount || 0) + ' baru)');
        }
        fetchStats();
        loadLogs();
      } catch (err) {
        if (showToastMsg) showToast('Sync error: ' + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerText = '🔄 Sync Files';
        }
      }
    };

    function loadData() {
      renderActiveTrace();
      fetchStats();
      loadLogs();
      checkRedisNavBadge();
    }

    // REDIS & BULLMQ MONITOR LOGIC
    async function checkRedisNavBadge() {
      try {
        const res = await fetch('/api/redis/info');
        if (res.ok) {
          const data = await res.json();
          const badge = document.getElementById('redisNavBadge');
          if (data.connected) {
            badge.className = 'nav-badge online';
            badge.innerText = 'Connected';
          } else {
            badge.className = 'nav-badge offline';
            badge.innerText = 'Offline';
          }
        }
      } catch {
        const badge = document.getElementById('redisNavBadge');
        if (badge) {
          badge.className = 'nav-badge offline';
          badge.innerText = 'Offline';
        }
      }
    }

    async function loadRedisData(isManual = false) {
      try {
        const res = await fetch('/api/redis/summary');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        redisState.server = data.server;
        redisState.queues = data.queues?.queues || [];
        redisState.keyspace = data.keyspace;

        renderRedisServer(data.server);
        renderBullQueues(redisState.queues);
        renderKeyspace(data.keyspace);
        renderCircuitBreaker(data.circuitBreaker);

        document.getElementById('redisLastUpdated').innerText = 'Updated: ' + new Date().toLocaleTimeString();
        if (isManual) showToast('Data Redis diperbarui!');
      } catch (err) {
        console.error('Failed to load Redis telemetry', err);
        renderRedisError(err);
      }
    }

    function renderCircuitBreaker(cb) {
      if (!cb) return;
      const pill = document.getElementById('cbStatusPill');
      const text = document.getElementById('cbStatusText');
      const failures = document.getElementById('cbFailures');
      const cooldown = document.getElementById('cbCooldown');
      const reason = document.getElementById('cbLastReason');

      if (!pill || !text) return;

      const state = (cb.state || 'CLOSED').toUpperCase();
      failures.innerText = (cb.consecutiveFailures || 0) + ' / 3';
      reason.innerText = cb.lastFailureReason || 'None';
      reason.title = cb.lastFailureReason || 'None';

      if (state === 'OPEN') {
        pill.className = 'redis-status-pill offline';
        pill.style.backgroundColor = '';
        pill.style.color = '';
        pill.style.border = '';
        const now = Date.now();
        const openedAt = cb.openedAt || now;
        const cooldownMs = cb.cooldownMs || 90000;
        const remaining = Math.max(0, Math.ceil((openedAt + cooldownMs - now) / 1000));
        text.innerText = 'STATE: OPEN (PROTECTION ACTIVE - ' + remaining + 's)';
        cooldown.innerText = remaining + 's remaining';
      } else if (state === 'HALF_OPEN') {
        pill.className = 'redis-status-pill';
        pill.style.backgroundColor = 'rgba(234, 179, 8, 0.15)';
        pill.style.color = '#facc15';
        pill.style.border = '1px solid rgba(234, 179, 8, 0.4)';
        text.innerText = 'STATE: HALF_OPEN (TRIAL PROBE)';
        cooldown.innerText = 'Testing 1 job';
      } else {
        pill.className = 'redis-status-pill online';
        pill.style.backgroundColor = '';
        pill.style.color = '';
        pill.style.border = '';
        text.innerText = 'STATE: CLOSED (HEALTHY)';
        cooldown.innerText = '90s standby';
      }
    }

    async function resetCircuitBreaker() {
      try {
        const res = await fetch('/api/circuit-breaker/reset', { method: 'POST' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        showToast('Circuit breaker di-reset ke CLOSED!');
        loadRedisData();
      } catch (err) {
        alert('Gagal reset circuit breaker: ' + err.message);
      }
    }

    function renderRedisError(err) {
      const statusPill = document.getElementById('redisStatusIndicator');
      statusPill.className = 'redis-status-pill offline';
      document.getElementById('redisStatusText').innerText = 'REDIS OFFLINE';
      document.getElementById('redisMetricMemory').innerText = 'OFFLINE';
      document.getElementById('redisMetricOps').innerText = 'OFFLINE';
      document.getElementById('redisMetricHitRatio').innerText = '0%';
      document.getElementById('bullQueuesContainer').innerHTML = \`
        <div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: var(--color-error);">
          Tidak dapat menghubungi server Redis: \${err.message}
        </div>
      \`;
    }

    function renderRedisServer(srv) {
      const statusPill = document.getElementById('redisStatusIndicator');
      const statusText = document.getElementById('redisStatusText');
      const navBadge = document.getElementById('redisNavBadge');

      if (srv && srv.connected) {
        statusPill.className = 'redis-status-pill online';
        statusText.innerText = 'REDIS CONNECTED';
        if (navBadge) {
          navBadge.className = 'nav-badge online';
          navBadge.innerText = 'Online';
        }

        document.getElementById('redisMetaUrl').innerText = srv.url;
        document.getElementById('redisMetaVersion').innerText = srv.server?.version || '--';
        document.getElementById('redisMetaUptime').innerText = srv.server?.uptimeHuman || '--';
        document.getElementById('redisMetaPid').innerText = srv.server?.processId || '--';

        // Memory card
        document.getElementById('redisMetricMemory').innerText = srv.memory?.usedMemoryHuman || '0 B';
        document.getElementById('redisMemorySub').innerText = \`Peak: \${srv.memory?.usedMemoryPeakHuman || '--'} | RSS: \${srv.memory?.usedMemoryRssHuman || '--'}\`;
        document.getElementById('redisFragBadge').innerText = \`Frag: \${srv.memory?.fragmentationRatio || '1'}\`;
        document.getElementById('redisPolicyBadge').innerText = \`Policy: \${srv.memory?.maxMemoryPolicy || 'noeviction'}\`;

        const peak = srv.memory?.usedMemoryPeakBytes || 1;
        const used = srv.memory?.usedMemoryBytes || 0;
        const memPct = Math.min(100, Math.round((used / peak) * 100));
        document.getElementById('redisMemoryBar').style.width = memPct + '%';

        // Ops & Clients card
        document.getElementById('redisMetricOps').innerText = (srv.stats?.instantaneousOpsPerSec || 0) + ' ops/s';
        document.getElementById('redisOpsSub').innerText = 'Total: ' + (srv.stats?.totalCommandsProcessed || 0).toLocaleString() + ' commands';
        document.getElementById('redisClientsBadge').innerText = 'Clients: ' + (srv.clients?.connectedClients || 0) + ' / ' + (srv.clients?.maxClients || 10000);
        document.getElementById('redisBlockedBadge').innerText = 'Blocked: ' + (srv.clients?.blockedClients || 0);

        // Hit Ratio
        const ratio = srv.stats?.hitRatioPercent || 0;
        document.getElementById('redisMetricHitRatio').innerText = ratio + '%';
        document.getElementById('redisHitSub').innerText = \`Hits: \${(srv.stats?.keyspaceHits || 0).toLocaleString()} | Misses: \${(srv.stats?.keyspaceMisses || 0).toLocaleString()}\`;
        document.getElementById('redisHitBar').style.width = ratio + '%';
      } else {
        statusPill.className = 'redis-status-pill offline';
        statusText.innerText = 'REDIS OFFLINE';
        if (navBadge) {
          navBadge.className = 'nav-badge offline';
          navBadge.innerText = 'Offline';
        }
      }
    }

    function renderBullQueues(queues) {
      const container = document.getElementById('bullQueuesContainer');
      container.innerHTML = '';

      let totalAllJobs = 0;
      let totalWaiting = 0;
      let totalActive = 0;

      if (!queues || queues.length === 0) {
        container.innerHTML = '<div style="padding: 24px; color: var(--text-dim); text-align: center;">Tidak ada antrian BullMQ aktif.</div>';
        return;
      }

      queues.forEach(q => {
        totalAllJobs += (q.counts?.total || 0);
        totalWaiting += (q.counts?.waiting || 0);
        totalActive += (q.counts?.active || 0);

        if (q.name === 'generate') {
          document.getElementById('bullGenerateBadge').innerText = 'generate: ' + (q.counts?.total || 0);
        }
        if (q.name === 'retention') {
          document.getElementById('bullRetentionBadge').innerText = 'retention: ' + (q.counts?.total || 0);
        }

        const total = q.counts?.total || 1;
        const wPct = ((q.counts?.waiting || 0) / total) * 100;
        const aPct = ((q.counts?.active || 0) / total) * 100;
        const cPct = ((q.counts?.completed || 0) / total) * 100;
        const fPct = ((q.counts?.failed || 0) / total) * 100;
        const dPct = ((q.counts?.delayed || 0) / total) * 100;

        const card = document.createElement('div');
        card.className = 'queue-card';

        card.innerHTML = \`
          <div class="queue-card-top">
            <div class="queue-title">
              <span>📬</span> \${q.name.toUpperCase()} QUEUE
            </div>
            <span class="queue-status-tag \${q.isPaused ? 'paused' : 'running'}">
              \${q.isPaused ? 'PAUSED' : 'RUNNING'}
            </span>
          </div>

          <!-- Segmented distribution bar -->
          <div>
            <div class="seg-bar" title="Waiting: \${q.counts.waiting}, Active: \${q.counts.active}, Completed: \${q.counts.completed}, Failed: \${q.counts.failed}">
              <div class="seg-part seg-waiting" style="width: \${wPct}%;"></div>
              <div class="seg-part seg-active" style="width: \${aPct}%;"></div>
              <div class="seg-part seg-completed" style="width: \${cPct}%;"></div>
              <div class="seg-part seg-failed" style="width: \${fPct}%;"></div>
              <div class="seg-part seg-delayed" style="width: \${dPct}%;"></div>
            </div>
          </div>

          <!-- Count pills -->
          <div class="queue-stat-pills">
            <span class="stat-pill"><span class="stat-pill-dot" style="background:#3b82f6;"></span> Waiting: <strong>\${q.counts.waiting}</strong></span>
            <span class="stat-pill"><span class="stat-pill-dot" style="background:#f59e0b;"></span> Active: <strong>\${q.counts.active}</strong></span>
            <span class="stat-pill"><span class="stat-pill-dot" style="background:#10b981;"></span> Completed: <strong>\${q.counts.completed}</strong></span>
            <span class="stat-pill"><span class="stat-pill-dot" style="background:#ef4444;"></span> Failed: <strong>\${q.counts.failed}</strong></span>
            <span class="stat-pill"><span class="stat-pill-dot" style="background:#8b5cf6;"></span> Delayed: <strong>\${q.counts.delayed}</strong></span>
          </div>

          <!-- Jobs list in queue -->
          <div style="margin-top: 4px;">
            <div style="font-size: 11px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; margin-bottom: 8px;">
              Sample Jobs (\${(q.jobs || []).length} dimuat):
            </div>
            <div style="max-height: 220px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px;">
              <table>
                <thead>
                  <tr>
                    <th style="padding: 6px 10px;">Job ID</th>
                    <th style="padding: 6px 10px;">State</th>
                    <th style="padding: 6px 10px;">Waktu</th>
                    <th style="padding: 6px 10px; text-align: right;">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  \${renderQueueJobsTable(q.jobs)}
                </tbody>
              </table>
            </div>
          </div>
        \`;

        container.appendChild(card);
      });

      document.getElementById('bullMetricTotal').innerText = totalAllJobs + ' Jobs';
      document.getElementById('bullMetricSub').innerText = \`Waiting: \${totalWaiting} | Active: \${totalActive}\`;
    }

    function renderQueueJobsTable(jobs) {
      if (!jobs || jobs.length === 0) {
        return '<tr><td colspan="4" style="text-align: center; padding: 12px; color: var(--text-muted);">Tidak ada job pada queue ini</td></tr>';
      }

      return jobs.map(j => {
        const time = j.timestamp ? j.timestamp.replace('T', ' ').slice(11, 19) : '--';
        const stateClass = \`job-state-\${(j.state || 'waiting').toLowerCase()}\`;
        const payloadStr = escapeAttr(JSON.stringify(j.data || {}, null, 2));

        return \`
          <tr>
            <td style="padding: 6px 10px; font-family: var(--font-mono); font-size: 11px; color: #93c5fd;">
              \${escapeHtml(j.id)}
            </td>
            <td style="padding: 6px 10px;">
              <span class="job-state-pill \${stateClass}">\${j.state}</span>
            </td>
            <td style="padding: 6px 10px; font-family: var(--font-mono); font-size: 11px; color: var(--text-dim);">
              \${time}
            </td>
            <td style="padding: 6px 10px; text-align: right;">
              <button class="btn btn-secondary" style="padding: 2px 6px; font-size: 10px;" onclick="inspectJobPayload('\${j.id}', '\${payloadStr}')">
                Inspect
              </button>
            </td>
          </tr>
        \`;
      }).join('');
    }

    window.inspectJobPayload = function(id, payloadJson) {
      try {
        const parsed = JSON.parse(payloadJson);
        alert(\`Job \${id} Data:\\n\\n\` + JSON.stringify(parsed, null, 2));
      } catch {
        alert(\`Job \${id} Data:\\n\\n\` + payloadJson);
      }
    };

    function renderKeyspace(ks) {
      const container = document.getElementById('keysCategoryRow');
      container.innerHTML = '';

      if (!ks || !ks.available) {
        document.getElementById('keysTableBody').innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-dim); padding: 20px;">Data keyspace tidak tersedia</td></tr>';
        return;
      }

      document.getElementById('keyspaceSampleCount').innerText = \`Total \${ks.totalSampled} keys sampled\`;

      // Render category tags
      const allTag = document.createElement('div');
      allTag.className = \`key-cat-pill \${redisState.selectedCategory === 'all' ? 'active' : ''}\`;
      allTag.innerHTML = \`Semua Kategori <span class="key-cat-count">\${ks.totalSampled}</span>\`;
      allTag.onclick = () => { selectKeyCategory('all'); };
      container.appendChild(allTag);

      for (const [cat, count] of Object.entries(ks.categories || {})) {
        if (count === 0) continue;
        const tag = document.createElement('div');
        tag.className = \`key-cat-pill \${redisState.selectedCategory === cat ? 'active' : ''}\`;
        tag.innerHTML = \`\${escapeHtml(cat)} <span class="key-cat-count">\${count}</span>\`;
        tag.onclick = () => { selectKeyCategory(cat); };
        container.appendChild(tag);
      }

      renderKeysTable();
    }

    function selectKeyCategory(cat) {
      redisState.selectedCategory = cat;
      const pills = document.querySelectorAll('.key-cat-pill');
      pills.forEach(p => p.classList.remove('active'));
      event.currentTarget.classList.add('active');
      renderKeysTable();
    }

    function renderKeysTable() {
      const tbody = document.getElementById('keysTableBody');
      const ks = redisState.keyspace;
      if (!ks || !ks.sampleKeys) return;

      const q = (redisState.keysFilter || '').toLowerCase().trim();
      const cat = redisState.selectedCategory;

      const filtered = ks.sampleKeys.filter(k => {
        if (cat !== 'all' && k.category !== cat) return false;
        if (q && !k.key.toLowerCase().includes(q)) return false;
        return true;
      });

      document.getElementById('keysShowingCount').innerText = \`Menampilkan \${filtered.length} keys\`;

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-dim);">Tidak ada key yang sesuai dengan kriteria filter.</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(k => {
        let ttlStr = 'Permanent';
        if (k.ttl > 0) {
          if (k.ttl < 60) ttlStr = k.ttl + 's';
          else if (k.ttl < 3600) ttlStr = Math.round(k.ttl / 60) + 'm';
          else ttlStr = (k.ttl / 3600).toFixed(1) + 'h';
        } else if (k.ttl === -2) {
          ttlStr = 'Expired';
        }

        return \`
          <tr>
            <td style="font-family: var(--font-mono); font-size: 12px; color: #f3f4f6; word-break: break-all;">
              \${escapeHtml(k.key)}
            </td>
            <td>
              <span class="mini-badge" style="background:#1e293b; color:#93c5fd;">\${escapeHtml(k.category)}</span>
            </td>
            <td>
              <span class="mini-badge" style="background:#0f172a; color:#a78bfa;">\${escapeHtml(k.type.toUpperCase())}</span>
            </td>
            <td style="font-family: var(--font-mono); font-size: 11px; color: \${k.ttl > 0 ? '#fbbf24' : '#9ca3af'};">
              \${ttlStr}
            </td>
          </tr>
        \`;
      }).join('');
    }

    // Attach Event Listeners
    document.getElementById('searchBtn').onclick = () => {
      state.q = document.getElementById('searchInput').value;
      state.page = 1;
      loadData();
    };

    document.getElementById('searchInput').onkeydown = (e) => {
      if (e.key === 'Enter') {
        state.q = e.target.value;
        state.page = 1;
        loadData();
      }
    };

    document.getElementById('keysFilterInput').oninput = (e) => {
      redisState.keysFilter = e.target.value;
      renderKeysTable();
    };

    document.getElementById('timeRange').onchange = (e) => {
      state.timeRange = e.target.value;
      const customDiv = document.getElementById('customDateRange');
      if (state.timeRange === 'custom') {
        customDiv.style.display = 'flex';
      } else {
        customDiv.style.display = 'none';
        state.startDate = '';
        state.endDate = '';
      }
      state.page = 1;
      loadData();
    };

    document.getElementById('startDateInput').onchange = (e) => {
      state.startDate = e.target.value;
      state.page = 1;
      loadData();
    };

    document.getElementById('endDateInput').onchange = (e) => {
      state.endDate = e.target.value;
      state.page = 1;
      loadData();
    };

    document.getElementById('levelSelect').onchange = (e) => {
      state.level = e.target.value;
      state.page = 1;
      loadData();
    };

    document.getElementById('serviceSelect').onchange = (e) => {
      state.service = e.target.value;
      state.page = 1;
      loadData();
    };

    document.getElementById('txInput').onchange = (e) => {
      state.transactionId = e.target.value.trim();
      state.page = 1;
      loadData();
    };

    document.getElementById('jobInput').onchange = (e) => {
      state.jobId = e.target.value.trim();
      state.page = 1;
      loadData();
    };

    document.getElementById('userInput').onchange = (e) => {
      state.userId = e.target.value.trim();
      state.page = 1;
      loadData();
    };

    document.getElementById('resetBtn').onclick = () => {
      document.getElementById('searchInput').value = '';
      document.getElementById('txInput').value = '';
      document.getElementById('jobInput').value = '';
      document.getElementById('userInput').value = '';
      document.getElementById('levelSelect').value = 'all';
      document.getElementById('serviceSelect').value = 'all';
      document.getElementById('timeRange').value = 'all';
      document.getElementById('customDateRange').style.display = 'none';
      document.getElementById('startDateInput').value = '';
      document.getElementById('endDateInput').value = '';

      state = {
        q: '',
        timeRange: 'all',
        startDate: '',
        endDate: '',
        level: 'all',
        service: 'all',
        transactionId: '',
        jobId: '',
        userId: '',
        page: 1,
        limit: 30,
        total: 0,
        logs: [],
        refreshTimer: state.refreshTimer
      };
      loadData();
    };

    document.getElementById('prevBtn').onclick = () => {
      if (state.page > 1) {
        state.page--;
        loadLogs();
      }
    };

    document.getElementById('nextBtn').onclick = () => {
      if (state.page * state.limit < state.total) {
        state.page++;
        loadLogs();
      }
    };

    document.getElementById('exportJsonBtn').onclick = () => {
      if (state.logs.length === 0) return;
      const blob = new Blob([JSON.stringify(state.logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`telemetry-logs-\${new Date().toISOString().slice(0, 10)}.json\`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    document.getElementById('autoRefresh').onchange = (e) => {
      if (state.refreshTimer) clearInterval(state.refreshTimer);
      const ms = Number(e.target.value);
      if (ms > 0) {
        state.refreshTimer = setInterval(() => {
          if (activeTab === 'logs') {
            loadData();
          } else {
            loadRedisData();
          }
        }, ms);
      }
    };

    // Initialize
    loadData();
    const initTimerMs = Number(document.getElementById('autoRefresh').value);
    if (initTimerMs > 0) {
      state.refreshTimer = setInterval(() => {
        if (activeTab === 'logs') {
          loadData();
        } else {
          loadRedisData();
        }
      }, initTimerMs);
    }
  </script>
</body>
</html>`;
}
