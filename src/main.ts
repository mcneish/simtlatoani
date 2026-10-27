import './style.css';
import { Game } from './game';
import { nextAction } from './sim/autoplayer';
import { runDemo } from './demo';

const game = new Game(document.getElementById('world') as HTMLCanvasElement, document.getElementById('ui')!);
// Exposed for automated playtests and the demo recorder.
Object.assign(window, { game, autoplayer: { nextAction } });
game.start();
if (new URLSearchParams(location.search).has('demo')) void runDemo(game);
