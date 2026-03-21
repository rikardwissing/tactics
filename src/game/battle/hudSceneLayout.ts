import Phaser from 'phaser';
import {
  applySharedDetailPanelLayout,
  applySharedMapTitleLayout,
  clearSharedDetailPanelLayout,
  type DetailPanelLayoutMetrics
} from './hudRenderer';

export type SharedMapTitleSectionLayoutOptions = Parameters<typeof applySharedMapTitleLayout>[0];

export function layoutSharedMapTitleSection(options: SharedMapTitleSectionLayoutOptions): void {
  applySharedMapTitleLayout(options);
}

export interface SharedDetailPanelSectionLayoutOptions
  extends Omit<Parameters<typeof applySharedDetailPanelLayout>[0], 'visible' | 'metrics'> {
  showDetailPanel: boolean;
  isIntroActive: boolean;
  hasHealthBar: boolean;
  measureDetailPanelLayout: (
    panel: Phaser.Geom.Rectangle,
    portraitVisible: boolean,
    hasHealthBar: boolean
  ) => DetailPanelLayoutMetrics;
  onClear?: () => void;
}

export function layoutSharedDetailPanelSection({
  showDetailPanel,
  isIntroActive,
  hasHealthBar,
  measureDetailPanelLayout,
  onClear,
  ...options
}: SharedDetailPanelSectionLayoutOptions): void {
  if (!showDetailPanel || isIntroActive) {
    clearSharedDetailPanelLayout(options);
    onClear?.();
    return;
  }

  const metrics = measureDetailPanelLayout(options.panel, options.portraitVisible, hasHealthBar);
  applySharedDetailPanelLayout({
    ...options,
    visible: options.alpha > 0.01,
    metrics
  });
}
