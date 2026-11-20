// First thing on the game page: the device's language, its catalog, and the watch that keeps the page in it (i18n.js).
import { pickLang, useCatalog, watch } from './i18n.js';
import { EN, NAMES } from './lang/en.js';
const l = pickLang();
if (l !== 'th') { useCatalog(l, {en: EN}[l], {en: NAMES}[l]); if (document.body) watch(document.body); else document.addEventListener('DOMContentLoaded', () => watch(document.body)); }
