const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')

const isDev = !app.isPackaged
const productionUrl = 'https://atendepro-tcc.vercel.app'
const desktopUrl = process.env.ELECTRON_START_URL || process.env.ELECTRON_APP_URL || (isDev ? 'http://localhost:3000' : productionUrl)
const loginUrl = new URL('/auth/login', desktopUrl).toString()

function createWindow() {
  const window = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#050b17',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  window.loadURL(loginUrl)

  if (isDev) {
    window.webContents.openDevTools({ mode: 'detach' })
  }
}

ipcMain.handle('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})

ipcMain.handle('window:toggle-maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) return false
  if (window.isMaximized()) {
    window.unmaximize()
    return false
  }
  window.maximize()
  return true
})

ipcMain.handle('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close()
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
