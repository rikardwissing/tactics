import './style.css';
import { createGame } from './game/createGame';

declare global {
  interface Window {
    __RENATIONS_GAME__?: ReturnType<typeof createGame>;
  }
}

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

app.innerHTML = `
  <main class="game-shell">
    <div class="game-root" id="game-root"></div>
  </main>
`;

const gameRoot = document.querySelector<HTMLDivElement>('#game-root');

if (!gameRoot) {
  throw new Error('Game root not found');
}

const measureGameRoot = () => {
  const bounds = gameRoot.getBoundingClientRect();

  return {
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height))
  };
};

const game = createGame('game-root', measureGameRoot());

if (import.meta.env.DEV) {
  window.__RENATIONS_GAME__ = game;
}

const refreshGameScale = () => {
  game.scale.refresh();
};

const resizeObserver = new ResizeObserver(() => {
  refreshGameScale();
});

resizeObserver.observe(gameRoot);
window.visualViewport?.addEventListener('resize', refreshGameScale);
