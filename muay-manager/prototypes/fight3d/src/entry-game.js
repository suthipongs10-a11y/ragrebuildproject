// Game page entry: the fight viewer plus the game layer. The lab page bundles main.js alone,
// so it carries none of the save and ranking code.
import { bootGame } from './game.js';
import './main.js';
window.MUAY_BOOT = bootGame;
