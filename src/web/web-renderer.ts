import type { DashboardViewModel } from './web-dashboard.service';

export function renderDashboard(model: DashboardViewModel): string {
  return `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OVDP Investment Bot</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #17202a;
      --muted: #637083;
      --line: #dfe5ec;
      --accent: #14532d;
      --accent-soft: #dcfce7;
      --blue: #1d4ed8;
      --red: #b91c1c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    .shell { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: clamp(28px, 4vw, 42px); line-height: 1.05; letter-spacing: 0; }
    h2 { margin: 0 0 14px; font-size: 18px; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); line-height: 1.55; }
    .badge { display: inline-flex; align-items: center; height: 30px; padding: 0 10px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-weight: 700; font-size: 13px; white-space: nowrap; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
    .card, .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
    .card { padding: 16px; min-height: 96px; }
    .metric { font-size: 28px; font-weight: 800; line-height: 1.1; }
    .label { color: var(--muted); font-size: 13px; margin-top: 8px; }
    .hint { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .columns { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 16px; }
    .panel { padding: 18px; }
    .chart-panel { margin-bottom: 16px; }
    .chart-wrap { position: relative; width: 100%; overflow: hidden; }
    .chart { display: block; width: 100%; height: auto; min-height: 250px; touch-action: none; }
    .chart-tooltip {
      position: absolute;
      z-index: 2;
      min-width: 160px;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 10px 26px rgba(15, 23, 42, 0.16);
      color: var(--text);
      font-size: 13px;
      line-height: 1.45;
      pointer-events: none;
      transform: translate(12px, 12px);
    }
    .chart-tooltip[hidden] { display: none; }
    .tooltip-date { font-weight: 800; margin-bottom: 4px; }
    .tooltip-rate { display: flex; justify-content: space-between; gap: 18px; }
    .tooltip-rate span:first-child { font-weight: 700; }
    .legend { display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0 14px; color: var(--muted); font-size: 13px; }
    .legend-item { display: inline-flex; align-items: center; gap: 6px; }
    .legend-swatch { width: 18px; height: 3px; border-radius: 999px; background: currentColor; }
    .rate-row, .command-row { display: flex; justify-content: space-between; gap: 16px; padding: 12px 0; border-top: 1px solid var(--line); }
    .rate-row:first-of-type, .command-row:first-of-type { border-top: 0; padding-top: 0; }
    .code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--blue); font-weight: 700; }
    .value { font-weight: 800; }
    .empty { color: var(--muted); border: 1px dashed var(--line); border-radius: 8px; padding: 22px; text-align: center; }
    .footer { margin-top: 18px; color: var(--muted); font-size: 13px; }
    a { color: var(--blue); text-decoration: none; font-weight: 700; }
    a:hover { text-decoration: underline; }
    @media (max-width: 860px) {
      header, .columns { display: block; }
      .badge { margin-top: 14px; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .panel + .panel { margin-top: 16px; }
    }
    @media (max-width: 520px) {
      .shell { padding: 24px 14px 36px; }
      .grid { grid-template-columns: 1fr; }
      .rate-row, .command-row { display: block; }
      .value { margin-top: 4px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <h1>OVDP Investment Bot</h1>
        <p>Operational dashboard for the Telegram bot that tracks Ukrainian government bond investments.</p>
      </div>
      <div class="badge">Bot mode: ${escapeHtml(model.botMode)}</div>
    </header>

    <section class="grid" aria-label="Metrics">
      ${model.metrics.map(renderMetric).join('')}
    </section>

    <section class="panel chart-panel">
      <h2>FX Rate Chart</h2>
      <div class="legend">
        <span class="legend-item" style="color: var(--blue)"><span class="legend-swatch"></span>USD/UAH</span>
        <span class="legend-item" style="color: var(--red)"><span class="legend-swatch"></span>EUR/UAH</span>
      </div>
      <div class="chart-wrap">${renderRateChart(model.rateHistory)}</div>
    </section>

    <section class="columns">
      <div class="panel">
        <h2>Latest FX Rates</h2>
        ${model.rates.map(renderRate).join('')}
      </div>
      <div class="panel">
        <h2>Telegram Commands</h2>
        ${model.commands.map(renderCommand).join('')}
      </div>
    </section>

    <p class="footer">
      Generated at ${escapeHtml(model.generatedAt.toISOString())}. Health endpoint:
      <a href="/health">/health</a>
    </p>
  </main>
${renderDashboardScript()}
</body>
</html>`;
}

function renderMetric(metric: DashboardViewModel['metrics'][number]): string {
  return `<article class="card">
    <div class="metric">${escapeHtml(metric.value)}</div>
    <div class="label">${escapeHtml(metric.label)}</div>
    ${metric.hint ? `<div class="hint">${escapeHtml(metric.hint)}</div>` : ''}
  </article>`;
}

function renderRate(rate: DashboardViewModel['rates'][number]): string {
  return `<div class="rate-row">
    <div><span class="code">${escapeHtml(rate.currency)}/UAH</span><div class="hint">${escapeHtml(rate.date)}</div></div>
    <div class="value">${escapeHtml(rate.rate)}</div>
  </div>`;
}

function renderCommand(command: DashboardViewModel['commands'][number]): string {
  return `<div class="command-row">
    <div class="code">${escapeHtml(command.command)}</div>
    <div>${escapeHtml(command.description)}</div>
  </div>`;
}

function renderRateChart(points: DashboardViewModel['rateHistory']): string {
  const dates = [...new Set(points.map((point) => point.date))].sort();
  if (dates.length < 2) {
    return '<div class="empty">Not enough stored FX rates to render a chart yet.</div>';
  }

  const width = 920;
  const height = 280;
  const padding = { top: 16, right: 54, bottom: 36, left: 58 };
  const values = points.map((point) => point.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const yMin = min - range * 0.08;
  const yMax = max + range * 0.08;

  const x = (date: string): number => {
    const index = dates.indexOf(date);
    if (dates.length === 1) {
      return padding.left;
    }
    return padding.left + (index / (dates.length - 1)) * (width - padding.left - padding.right);
  };
  const y = (value: number): number =>
    padding.top + ((yMax - value) / (yMax - yMin)) * (height - padding.top - padding.bottom);

  const lines = ['USD', 'EUR']
    .map((currency) => {
      const currencyPoints = points.filter((point) => point.currency === currency);
      if (currencyPoints.length < 2) {
        return '';
      }
      const path = currencyPoints.map((point) => `${x(point.date).toFixed(1)},${y(point.rate).toFixed(1)}`).join(' ');
      const color = currency === 'USD' ? 'var(--blue)' : 'var(--red)';
      return `<polyline points="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .join('');

  const gridValues = makeTicks(yMin, yMax, 4);
  const grid = gridValues
    .map((value) => {
      const yy = y(value);
      return `<line x1="${padding.left}" y1="${yy.toFixed(1)}" x2="${width - padding.right}" y2="${yy.toFixed(1)}" stroke="#dfe5ec" />
        <text x="${padding.left - 10}" y="${(yy + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="#637083">${value.toFixed(2)}</text>`;
    })
    .join('');

  const firstDate = dates[0] ?? '';
  const lastDate = dates[dates.length - 1] ?? '';
  const tooltipPoints = dates.map((date) => {
    const valuesForDate = points.filter((point) => point.date === date);
    return {
      date,
      x: x(date),
      rates: valuesForDate.map((point) => ({
        currency: point.currency,
        rate: point.rate,
        y: y(point.rate),
      })),
    };
  });

  return `<svg
    class="chart"
    viewBox="0 0 ${width} ${height}"
    role="img"
    aria-label="USD and EUR exchange rate history"
    data-fx-chart
    data-points="${escapeAttribute(JSON.stringify(tooltipPoints))}"
  >
    <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="#ffffff" />
    ${grid}
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#aeb8c5" />
    ${lines}
    <g data-chart-marker hidden>
      <line data-marker-line x1="0" y1="${padding.top}" x2="0" y2="${height - padding.bottom}" stroke="#17202a" stroke-width="1" stroke-dasharray="4 4" opacity="0.45" />
      <circle data-marker-usd cx="0" cy="0" r="4.5" fill="#ffffff" stroke="var(--blue)" stroke-width="3" hidden />
      <circle data-marker-eur cx="0" cy="0" r="4.5" fill="#ffffff" stroke="var(--red)" stroke-width="3" hidden />
    </g>
    <text x="${padding.left}" y="${height - 10}" font-size="12" fill="#637083">${escapeHtml(firstDate)}</text>
    <text x="${width - padding.right}" y="${height - 10}" text-anchor="end" font-size="12" fill="#637083">${escapeHtml(lastDate)}</text>
  </svg>`;
}

function makeTicks(min: number, max: number, count: number): number[] {
  if (count <= 1) {
    return [min];
  }
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function renderDashboardScript(): string {
  return `<script>
(() => {
  const chart = document.querySelector('[data-fx-chart]');
  if (!chart) {
    return;
  }

  const wrap = chart.closest('.chart-wrap');
  const points = JSON.parse(chart.dataset.points || '[]');
  const marker = chart.querySelector('[data-chart-marker]');
  const markerLine = chart.querySelector('[data-marker-line]');
  const markerUsd = chart.querySelector('[data-marker-usd]');
  const markerEur = chart.querySelector('[data-marker-eur]');
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  wrap.appendChild(tooltip);

  const formatRate = (rate) => Number(rate).toFixed(4);
  const setCircle = (circle, ratePoint) => {
    if (!circle) {
      return;
    }
    if (!ratePoint) {
      circle.setAttribute('hidden', '');
      return;
    }
    circle.removeAttribute('hidden');
    circle.setAttribute('cx', String(ratePoint.x));
    circle.setAttribute('cy', String(ratePoint.y));
  };

  const hide = () => {
    tooltip.hidden = true;
    marker?.setAttribute('hidden', '');
  };

  chart.addEventListener('pointermove', (event) => {
    if (!points.length || !wrap) {
      return;
    }

    const chartRect = chart.getBoundingClientRect();
    const viewX = ((event.clientX - chartRect.left) / chartRect.width) * chart.viewBox.baseVal.width;
    const point = points.reduce((closest, item) =>
      Math.abs(item.x - viewX) < Math.abs(closest.x - viewX) ? item : closest,
    );

    const usd = point.rates.find((item) => item.currency === 'USD');
    const eur = point.rates.find((item) => item.currency === 'EUR');
    tooltip.innerHTML = [
      '<div class="tooltip-date">' + point.date + '</div>',
      usd ? '<div class="tooltip-rate"><span>USD/UAH</span><strong>' + formatRate(usd.rate) + '</strong></div>' : '',
      eur ? '<div class="tooltip-rate"><span>EUR/UAH</span><strong>' + formatRate(eur.rate) + '</strong></div>' : '',
    ].join('');
    tooltip.hidden = false;

    marker?.removeAttribute('hidden');
    markerLine?.setAttribute('x1', String(point.x));
    markerLine?.setAttribute('x2', String(point.x));
    setCircle(markerUsd, usd ? { x: point.x, y: usd.y } : null);
    setCircle(markerEur, eur ? { x: point.x, y: eur.y } : null);

    const wrapRect = wrap.getBoundingClientRect();
    const left = event.clientX - wrapRect.left;
    const top = event.clientY - wrapRect.top;
    const maxLeft = Math.max(8, wrapRect.width - tooltip.offsetWidth - 24);
    const maxTop = Math.max(8, wrapRect.height - tooltip.offsetHeight - 24);
    tooltip.style.left = Math.min(Math.max(left, 8), maxLeft) + 'px';
    tooltip.style.top = Math.min(Math.max(top, 8), maxTop) + 'px';
  });

  chart.addEventListener('pointerleave', hide);
  chart.addEventListener('pointercancel', hide);
})();
</script>`;
}
