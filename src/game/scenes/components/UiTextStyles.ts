import Phaser from 'phaser';
import {
  UI_COLOR_TEXT,
  UI_COLOR_TEXT_STROKE
} from './UiColors';

const UI_FONT_FAMILY = '"Palatino Linotype", "Book Antiqua", serif';

function withDefaults(style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: UI_FONT_FAMILY,
    color: UI_COLOR_TEXT,
    ...style
  };
}

export const UI_TEXT_LABEL = withDefaults({
  fontSize: '12px',
  fontStyle: 'bold',
  letterSpacing: 1.2
});

export const UI_TEXT_LABEL_CENTER = withDefaults({
  fontSize: '12px',
  fontStyle: 'bold',
  align: 'center',
  letterSpacing: 4
});

export const UI_TEXT_HEADER_TITLE = withDefaults({
  fontSize: '12px',
  fontStyle: 'bold',
  letterSpacing: 1.2
});

export const UI_TEXT_TITLE = withDefaults({
  fontSize: '18px',
  fontStyle: 'bold'
});

export const UI_TEXT_TITLE_CENTER = withDefaults({
  fontSize: '18px',
  fontStyle: 'bold',
  align: 'center'
});

export const UI_TEXT_DISPLAY_CENTER = withDefaults({
  fontSize: '32px',
  fontStyle: 'bold',
  align: 'center',
  letterSpacing: 10,
  stroke: UI_COLOR_TEXT_STROKE,
  strokeThickness: 8
});

export const UI_TEXT_BODY = withDefaults({
  fontSize: '14px',
  lineSpacing: 5
});

export const UI_TEXT_BODY_CENTER = withDefaults({
  fontSize: '14px',
  align: 'center',
  lineSpacing: 8
});

export const UI_TEXT_ACTION = withDefaults({
  fontSize: '14px',
  fontStyle: 'bold'
});

export const UI_TEXT_WORLD_LABEL = withDefaults({
  fontSize: '14px',
  stroke: UI_COLOR_TEXT_STROKE,
  strokeThickness: 4
});

export const UI_TEXT_DAMAGE = withDefaults({
  fontSize: '18px',
  fontStyle: 'bold',
  stroke: UI_COLOR_TEXT_STROKE,
  strokeThickness: 6
});

export const UI_TEXT_DAMAGE_CRITICAL = withDefaults({
  fontSize: '32px',
  fontStyle: 'bold',
  stroke: UI_COLOR_TEXT_STROKE,
  strokeThickness: 6
});
