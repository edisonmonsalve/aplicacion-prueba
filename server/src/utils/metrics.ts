const startedAt = Date.now();

interface RouteMetric {
  count: number;
  errors: number;
  durationSumMs: number;
  durationMaxMs: number;
}

const totals: RouteMetric = { count: 0, errors: 0, durationSumMs: 0, durationMaxMs: 0 };
const byStatus = new Map<number, number>();
const byRoute = new Map<string, RouteMetric>();

function metricFor(route: string): RouteMetric {
  let metric = byRoute.get(route);
  if (!metric) {
    metric = { count: 0, errors: 0, durationSumMs: 0, durationMaxMs: 0 };
    byRoute.set(route, metric);
  }
  return metric;
}

function add(metric: RouteMetric, status: number, durationMs: number) {
  metric.count += 1;
  metric.durationSumMs += durationMs;
  metric.durationMaxMs = Math.max(metric.durationMaxMs, durationMs);
  if (status >= 500) metric.errors += 1;
}

/** Registra una petición terminada. Se llama desde el middleware de acceso. */
export function recordRequest(route: string, status: number, durationMs: number) {
  add(totals, status, durationMs);
  add(metricFor(route), status, durationMs);
  byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Métricas en memoria desde el arranque del proceso. Pensadas para una lectura
 * operativa básica; para series históricas hay que enviarlas a un colector.
 */
export function metricsSnapshot() {
  const routes = Array.from(byRoute.entries())
    .map(([route, metric]) => ({
      route,
      count: metric.count,
      errors: metric.errors,
      avg_ms: metric.count ? round(metric.durationSumMs / metric.count) : 0,
      max_ms: round(metric.durationMaxMs),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return {
    uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
    requests: {
      total: totals.count,
      errors_5xx: totals.errors,
      by_status: Object.fromEntries(Array.from(byStatus.entries()).sort(([a], [b]) => a - b)),
    },
    latency_ms: {
      avg: totals.count ? round(totals.durationSumMs / totals.count) : 0,
      max: round(totals.durationMaxMs),
    },
    routes,
  };
}
