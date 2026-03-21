export interface EngineSceneMetricsSnapshot {
  scene: string;
  childCount: number;
  residentChunkCount: number;
  pooledHighlightObjects: number;
  highlightDrawCount: number;
  highlightInvalidations: number;
  hudRefreshCount: number;
  hudInvalidations: number;
  lightingRefreshCount: number;
  lightingInvalidations: number;
  turnOrderInvalidations: number;
  battleShellInvalidations: number;
  battleObjectCountBaseline: number | null;
  battleObjectCountDelta: number | null;
  updatedAt: number;
}

declare global {
  interface Window {
    __RENATIONS_ENGINE_METRICS__?: Record<string, EngineSceneMetricsSnapshot>;
  }
}

const sceneMetrics = new Map<string, EngineSceneMetricsSnapshot>();

function publish(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.__RENATIONS_ENGINE_METRICS__ = Object.fromEntries(sceneMetrics.entries());
}

export function publishEngineSceneMetrics(snapshot: EngineSceneMetricsSnapshot): void {
  sceneMetrics.set(snapshot.scene, snapshot);
  publish();
}

export function clearEngineSceneMetrics(scene: string): void {
  sceneMetrics.delete(scene);
  publish();
}
