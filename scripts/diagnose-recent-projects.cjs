const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await win.loadFile(path.join(__dirname, '../dist/index.html'));

  const result = await win.webContents.executeJavaScript(`
    (() => {
      const allKeys = [];
      const projectKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        allKeys.push(k);
        if (k.startsWith('vnest_project_') || k.startsWith('hl_recovery_data_')) {
          projectKeys.push(k);
        }
      }
      const recentsRaw = localStorage.getItem('vnest_recent_projects');
      const snapshots = localStorage.getItem('hl_recovery_snapshots');
      const autosave = localStorage.getItem('vnest_autosave');
      const sampleProj = localStorage.getItem('vnest_project_proj_42wx7nrgdmvf9al2d');
      return {
        allKeys,
        projectKeys,
        recents: recentsRaw ? JSON.parse(recentsRaw) : null,
        snapshots: snapshots ? JSON.parse(snapshots) : null,
        autosave: autosave ? JSON.parse(autosave) : null,
        sampleProj: sampleProj ? JSON.parse(sampleProj) : null,
      };
    })()
  `);

  console.log('All localStorage keys:', result.allKeys);
  console.log('Project / Snapshot data keys:', result.projectKeys);
  console.log('Recents list count:', result.recents ? result.recents.length : 0);
  console.log('Autosave:', result.autosave ? { id: result.autosave.id, name: result.autosave.name, clips: result.autosave.tracks?.reduce((s,t)=>s+t.clips.length,0) } : null);
  console.log('Sample proj:', result.sampleProj ? { id: result.sampleProj.id, name: result.sampleProj.name, clips: result.sampleProj.tracks?.reduce((s,t)=>s+t.clips.length,0) } : null);
  if (result.recents) {
    for (const r of result.recents) {
      console.log(`Recent item: id=${r.id}, name="${r.name}", inLocalStorage=${result.allKeys.includes('vnest_project_' + r.id)}`);
    }
  }


  app.quit();
});
