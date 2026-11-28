import { contextBridge } from 'electron';

// The renderer talks to the main process only through this bridge.
// Save / window / Steam IPC channels are added here as later milestones need them.
contextBridge.exposeInMainWorld('dicebound', {
  isDesktop: true,
});
