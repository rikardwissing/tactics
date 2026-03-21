import Phaser from 'phaser';
import { TILE_HEIGHT } from '../core/mapData';
import { getTile } from '../core/pathfinding';
import type { Point, TileData } from '../core/types';
import type { LevelDefinition, MapPropPlacement } from '../levels/types';
import type { RuntimeBattleArenaBounds, RuntimeBattlePreservedLightSourceState } from '../sceneSession';
import { PROP_RENDER_CONFIG } from './rendering';

export interface WorldDynamicLightSource<ViewRef = unknown> {
  propId: string | null;
  tile: Point & { height: number };
  point: Phaser.Math.Vector2;
  radius: number;
  color: number;
  strength: number;
  sourceOffsetY: number;
  view?: ViewRef;
}

interface CollectWorldLightSourcesArgs<ViewRef> {
  time: number;
  lightBoost: number;
  props: readonly MapPropPlacement[];
  map: readonly TileData[];
  preservedLightSources?: readonly RuntimeBattlePreservedLightSourceState[];
  isoToScreen(tile: Point & { height: number }): Phaser.Math.Vector2;
  getPropView(propId: string): ViewRef | undefined;
}

export class WorldLightingController<ViewRef = unknown> {
  collectDynamicLightSources({
    time,
    lightBoost,
    props,
    map,
    preservedLightSources = [],
    isoToScreen,
    getPropView
  }: CollectWorldLightSourcesArgs<ViewRef>): WorldDynamicLightSource<ViewRef>[] {
    if (preservedLightSources.length > 0) {
      return preservedLightSources.map((source) => {
        const phase = (source.x * 17 + source.y * 31) * 0.11;
        const flicker = 0.92 + Math.sin(time * 0.011 + phase) * 0.06 + Math.sin(time * 0.019 + phase * 1.7) * 0.04;
        const tile = { x: source.x, y: source.y, height: source.height };
        const point = isoToScreen(tile);

        return {
          propId: source.propId ?? null,
          tile,
          point: new Phaser.Math.Vector2(point.x, point.y + TILE_HEIGHT / 2 - 2),
          radius: source.radius,
          color: source.color,
          strength: source.intensity * lightBoost * flicker,
          sourceOffsetY: source.sourceOffsetY,
          view: source.propId ? getPropView(source.propId) : undefined
        };
      });
    }

    return props.flatMap((prop) => {
      const light = PROP_RENDER_CONFIG[prop.assetId].light;

      if (!light) {
        return [];
      }

      const tile = getTile(map as TileData[], prop.x, prop.y);

      if (!tile) {
        return [];
      }

      const phase = (prop.x * 17 + prop.y * 31) * 0.11;
      const flicker = 0.92 + Math.sin(time * 0.011 + phase) * 0.06 + Math.sin(time * 0.019 + phase * 1.7) * 0.04;
      const point = isoToScreen(tile);

      return [{
        propId: prop.id,
        tile,
        point: new Phaser.Math.Vector2(point.x, point.y + TILE_HEIGHT / 2 - 2),
        radius: light.radius,
        color: light.color,
        strength: light.intensity * lightBoost * flicker,
        sourceOffsetY: light.sourceOffsetY,
        view: getPropView(prop.id)
      }];
    });
  }

  createPreservedLightSources(
    sourceLevel: LevelDefinition,
    arenaBounds: RuntimeBattleArenaBounds
  ): RuntimeBattlePreservedLightSourceState[] {
    return sourceLevel.props.flatMap((prop) => {
      const light = PROP_RENDER_CONFIG[prop.assetId].light;

      if (!light) {
        return [];
      }

      return [{
        id: `world-encounter-light:${prop.id}`,
        x: prop.x - arenaBounds.x,
        y: prop.y - arenaBounds.y,
        height: sourceLevel.heights[prop.y]?.[prop.x] ?? 0,
        radius: light.radius,
        color: light.color,
        intensity: light.intensity,
        sourceOffsetY: light.sourceOffsetY,
        propId: prop.id
      }];
    });
  }
}
