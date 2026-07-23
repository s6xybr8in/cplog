// CP-Log 데스크톱(Windows) 셸.
// 렌더러는 웹 버전과 완전히 같은 번들이다 — 앱 코드에 Electron 전용 분기는 없다.
const { app, BrowserWindow, protocol, shell, net } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const RENDERER_DIR = path.join(__dirname, '..', 'dist-electron')
// 개발 중에는 빌드 대신 Vite dev 서버를 띄운다 — `npm run dev` 실행 후 `npm run electron:dev`.
// (Windows npm 스크립트에서 env 주입이 셸마다 달라 --dev 플래그를 기본 경로로 둔다)
const DEV_URL = process.env.VITE_DEV_SERVER_URL || (process.argv.includes('--dev') ? 'http://localhost:5173' : null)

// file://은 오리진이 불투명(opaque)해 localStorage/IndexedDB가 보장되지 않는다.
// 표준·보안 스킴으로 등록한 app://에서 띄워야 노트·에셋 저장소가 웹 버전과 동일하게 동작한다.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 940,
    minHeight: 600,
    // 첫 페인트 전 흰 화면이 번쩍이지 않도록 다크 테마 배경(--color-bg)으로 맞춤
    backgroundColor: '#12151a',
    show: false,
    title: 'CP-Log',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false },
  })
  win.once('ready-to-show', () => win.show())

  // 노트 안의 외부 링크(Codeforces·AtCoder 등)는 앱 창을 덮어쓰지 않고 기본 브라우저로 연다
  const openExternal = (url) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('app://') || (DEV_URL && url.startsWith(DEV_URL))) return
    event.preventDefault()
    openExternal(url)
  })

  if (DEV_URL) win.loadURL(DEV_URL)
  else win.loadURL('app://cplog/index.html')
  return win
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const rel = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '')
    const filePath = path.resolve(RENDERER_DIR, rel)
    // 번들 디렉터리 밖으로 벗어나는 경로(../ 등)는 거부
    if (filePath !== RENDERER_DIR && !filePath.startsWith(RENDERER_DIR + path.sep)) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
