const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopShell', {
  platform: process.platform,
  isDesktop: true,
  setTheme: (theme) => ipcRenderer.send('window:set-theme', theme),
})
