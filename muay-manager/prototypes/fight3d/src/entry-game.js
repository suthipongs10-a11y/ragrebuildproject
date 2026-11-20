// Game page entry: the fight viewer plus the game layer. The lab page bundles main.js alone,
// so it carries none of the save and ranking code.
import './i18n-boot.js'; // before anything is drawn: the page in the device's language
import { bootGame } from './game.js';
import './main.js';
window.MUAY_BOOT = bootGame;
