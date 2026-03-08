import './style.css';
import { createGame } from './game/createGame';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

app.innerHTML = `
  <main class="shell">
    <section class="stage-frame">
      <div class="stage-header">
        <div>
          <p class="eyebrow">Phaser 3 + TypeScript</p>
          <h1>Crimson Tactics</h1>
        </div>
        <p class="header-copy">
          A compact tactics RPG homage built around elevation, initiative, and
          pressure on the high ground.
        </p>
      </div>
      <div class="stage" id="game-root"></div>
      <div class="stage-footer">
        <span>Click highlighted tiles to move and attack.</span>
        <span>Space waits. R restarts the battle.</span>
      </div>
    </section>
  </main>
`;

createGame('game-root');
