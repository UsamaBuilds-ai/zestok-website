const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const WIN_UNPACKED = path.join(DIST, 'win-unpacked');
const APP_EXE = path.join(WIN_UNPACKED, 'Zestok.exe');
const ICON = path.join(ROOT, 'Icons', 'zestok.ico');
const RCEDIT = path.join(ROOT, 'rcedit-x64.exe');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close(); fs.unlinkSync(dest); download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { file.close(); fs.unlinkSync(dest); reject(err); });
  });
}

async function main() {
  if (!fs.existsSync(RCEDIT)) {
    console.log('Downloading rcedit-x64.exe...');
    await download('https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe', RCEDIT);
  }

  console.log('--- Step 1: Pack app ---');
  run('npx electron-builder --dir');

  console.log('--- Step 2: Apply custom icon ---');
  run(`"${RCEDIT}" "${APP_EXE}" --set-icon "${ICON}"`);

  console.log('--- Step 3: Build NSIS installer ---');
  const config = {
    win: { target: 'nsis', artifactName: 'Zestok.${ext}' },
    nsis: {
      oneClick: false, perMachine: false, allowToChangeInstallationDirectory: false,
      installerIcon: ICON, uninstallerIcon: ICON, deleteAppDataOnUninstall: true,
      createDesktopShortcut: true, createStartMenuShortcut: true, guid: 'com.usama.zestok',
      shortcutName: 'Zestok', include: 'build/installer.nsh', runAfterFinish: true, warningsAsErrors: false,
    },
  };
  const configPath = path.join(DIST, 'build-config.json');
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  run(`npx electron-builder --win nsis --prepackaged "${WIN_UNPACKED}" --config "${configPath}"`);
  fs.unlinkSync(configPath);

  console.log('\n✓ Build complete! Custom icon applied.');
}

main().catch(err => { console.error('FAILED:', err); process.exit(1); });
