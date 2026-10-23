import {SpriteConfig} from './utils/helper';

/**
 * Configuration for Subtract Lab.
 */
export const CONFIG = {
  // Game
  title: {
    value: 'Subtract Lab',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 1376,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 768,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // System
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // Theme
  backgroundColor: {
    value: '#1e293b',
    type: 'color',
    label: 'Background Color',
    group: 'THEME',
  },
  primaryColor: {
    value: '#f59e0b',
    type: 'color',
    label: 'Primary Color',
    group: 'THEME',
  },
  fontFamily: {
    value: 'Nunito, ui-sans-serif, system-ui, sans-serif',
    type: 'string',
    label: 'Font Family',
    group: 'THEME',
  },

  // Audio
  defaultMusicVolume: {
    value: 0.5,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
  },
  defaultSfxVolume: {
    value: 0.7,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
  },

  // Rules
  problemsPerSession: {
    value: 5,
    type: 'number',
    label: 'Problems Per Session',
    group: 'Rules',
  },
  maxMistakes: {
    value: 5,
    type: 'number',
    label: 'Max Mistakes Allowed',
    group: 'Rules',
  },
  scorePerDigit: {
    value: 100,
    type: 'number',
    label: 'Score Per Correct Digit',
    group: 'Rules',
  },
  scorePerRegroup: {
    value: 150,
    type: 'number',
    label: 'Score Per Regroup Step',
    group: 'Rules',
  },
  bonusProblemComplete: {
    value: 500,
    type: 'number',
    label: 'Bonus Per Solved Problem',
    group: 'Rules',
  },
  minMinuendDigits: {
    value: 4,
    type: 'number',
    label: 'Min Top Digits',
    group: 'Rules',
  },
  maxMinuendDigits: {
    value: 6,
    type: 'number',
    label: 'Max Top Digits',
    group: 'Rules',
  },
  hintEnabled: {
    value: true,
    type: 'boolean',
    label: 'Enable Step Hints',
    group: 'Rules',
  },

  // Assets dimensions & aspect ratios
  assetBgMathLabAspectRatio: {
    value: 1376 / 768,
    type: 'number',
    label: 'Math Lab BG Aspect Ratio',
    group: 'ASSETS',
  },
  assetBgMathLabWidth: {
    value: 1376,
    type: 'number',
    label: 'Math Lab BG Width',
    group: 'ASSETS',
  },
  assetBgMathLabHeight: {
    value: 768,
    type: 'number',
    label: 'Math Lab BG Height',
    group: 'ASSETS',
  },

  assetRewardGoldStarAspectRatio: {
    value: 634 / 628,
    type: 'number',
    label: 'Gold Star Aspect Ratio',
    group: 'ASSETS',
  },
  assetRewardGoldStarWidth: {
    value: 634,
    type: 'number',
    label: 'Gold Star Width',
    group: 'ASSETS',
  },
  assetRewardGoldStarHeight: {
    value: 628,
    type: 'number',
    label: 'Gold Star Height',
    group: 'ASSETS',
  },

  assetIconPencilCrossAspectRatio: {
    value: 695 / 699,
    type: 'number',
    label: 'Pencil Icon Aspect Ratio',
    group: 'ASSETS',
  },
  assetIconPencilCrossWidth: {
    value: 695,
    type: 'number',
    label: 'Pencil Icon Width',
    group: 'ASSETS',
  },
  assetIconPencilCrossHeight: {
    value: 699,
    type: 'number',
    label: 'Pencil Icon Height',
    group: 'ASSETS',
  },

  assetMascotProfOwlAspectRatio: {
    value: 527 / 674,
    type: 'number',
    label: 'Prof Owl Mascot Aspect Ratio',
    group: 'ASSETS',
  },
  assetMascotProfOwlWidth: {
    value: 527,
    type: 'number',
    label: 'Prof Owl Mascot Width',
    group: 'ASSETS',
  },
  assetMascotProfOwlHeight: {
    value: 674,
    type: 'number',
    label: 'Prof Owl Mascot Height',
    group: 'ASSETS',
  },

  // Template sprite fallback placeholder (preserved)
  playerSprite: {
    value: undefined as SpriteConfig | undefined,
    type: 'sprite',
    label: 'Player Sprite',
    group: 'Visuals',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/**
 * Type helper for reading values in game code
 */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

export const PLACE_VALUE_NAMES = [
  'Ones (1s)',
  'Tens (10s)',
  'Hundreds (100s)',
  'Thousands (1,000s)',
  'Ten-Thousands (10,000s)',
  'Hundred-Thousands (100,000s)',
];

export const PLACE_VALUE_SHORT = ['1s', '10s', '100s', '1k', '10k', '100k'];
