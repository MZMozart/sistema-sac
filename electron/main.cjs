const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron')
const path = require('path')

const isDev = !app.isPackaged
const productionUrl = 'https://atendepro-tcc.vercel.app'
const desktopUrl = process.env.ELECTRON_START_URL || process.env.ELECTRON_APP_URL || (isDev ? 'http://localhost:3000' : productionUrl)
const loginUrl = new URL('/auth/login', desktopUrl).toString()

nativeTheme.themeSource = 'dark'

function getWindowTheme(theme) {
  const dark = theme !== 'light'
  return {
    backgroundColor: dark ? '#050b17' : '#f6f8fc',
    titleBarColor: dark ? '#050b17' : '#f6f8fc',
    symbolColor: dark ? '#94a3b8' : '#334155',
  }
}

function applyWindowTheme(window, theme) {
  const colors = getWindowTheme(theme)
  window.setBackgroundColor(colors.backgroundColor)
  if (typeof window.setTitleBarOverlay === 'function') {
    window.setTitleBarOverlay({
      color: colors.titleBarColor,
      symbolColor: colors.symbolColor,
      height: 30,
    })
  }
}

function createWindow() {
  const colors = getWindowTheme('dark')
  const window = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: colors.backgroundColor,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: colors.titleBarColor,
      symbolColor: colors.symbolColor,
      height: 30,
    },
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

  applyWindowTheme(window, 'dark')
  window.loadURL(loginUrl)

  if (isDev) {
    window.webContents.openDevTools({ mode: 'detach' })
  }
}

ipcMain.on('window:set-theme', (_event, theme) => {
  nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark'
  BrowserWindow.getAllWindows().forEach((window) => {
    applyWindowTheme(window, theme)
  })
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
