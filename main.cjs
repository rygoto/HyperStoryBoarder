const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'), // preload.jsを使う
        },
        icon: path.join(__dirname, 'assets', 'icon.ico') // アイコン（任意）
    });

    // 開発中はViteサーバー、本番はdist/index.html
    if (process.env.NODE_ENV === 'development') {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile('dist/index.html');
        // win.webContents.openDevTools(); ← 本番ではコメントアウト
    }
}

app.whenReady().then(createWindow);

// Rendererからblendファイルパスを受け取りBlenderで開く
ipcMain.handle('open-blend', (event, blendPath) => {
    if (blendPath) {
        // Windows用: startコマンドで既定アプリ（Blender）で開く
        exec(`start "" "${blendPath}"`);
    }
});

const handleBlendFileChange = (pageIdx, cutIdx, file) => {
    console.log('blendファイル紐付け:', file.path); // ここで絶対パスが出るはず
    setPages(prev => {
        const newPages = [...prev];
        newPages[pageIdx] = {
            ...newPages[pageIdx],
            blendFiles: newPages[pageIdx].blendFiles.map((b, idx) => idx === cutIdx ? file.path : b)
        };
        return newPages;
    });
};

// 保存先ディレクトリ
function getStoryboardDir() {
    const dir = path.join(app.getPath('userData'), 'storyboards');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

// 保存
ipcMain.handle('save-storyboard', async (event, name, data) => {
    const filePath = path.join(getStoryboardDir(), `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
});

// 一覧
ipcMain.handle('list-storyboards', async () => {
    const dir = getStoryboardDir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace(/\.json$/, ''));
});

// 読み込み
ipcMain.handle('load-storyboard', async (event, name) => {
    const filePath = path.join(getStoryboardDir(), `${name}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}); 