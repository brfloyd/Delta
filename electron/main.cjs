const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const simpleGit = require("simple-git");
const parseDiff = require("parse-diff");
const Diff = require("diff");

const isDev = !app.isPackaged;

function createWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0b1018",
    title: "Delta",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    window.loadURL("http://127.0.0.1:5173");
  } else {
    window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

async function getGit(repoPath) {
  const git = simpleGit({ baseDir: repoPath, binary: "git" });
  await git.revparse(["--show-toplevel"]);
  return git;
}

ipcMain.handle("repo:select", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Choose local git repository",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("repo:branches", async (_event, repoPath) => {
  const git = await getGit(repoPath);
  const branches = await git.branchLocal();
  return {
    branches: branches.all,
    current: branches.current,
  };
});

ipcMain.handle("repo:diff", async (_event, payload) => {
  const { repoPath, workingBranch, targetBranch } = payload;
  const git = await getGit(repoPath);
  const rawDiff = await git.diff([
    "--no-color",
    "--find-renames",
    "--find-copies",
    `${targetBranch}...${workingBranch}`,
  ]);
  const parsed = parseDiff(rawDiff);

  for (const file of parsed) {
    if (file.binary) continue;
    for (const chunk of file.chunks) {
      const newChanges = [];
      let i = 0;
      while (i < chunk.changes.length) {
        const current = chunk.changes[i];
        const next = chunk.changes[i + 1];

        if (current.type === "del" && next && next.type === "add") {
          const wordDiff = Diff.diffWordsWithSpace(
            current.content.slice(1),
            next.content.slice(1),
          );
          current.parts = wordDiff.filter((p) => !p.added);
          next.parts = wordDiff.filter((p) => !p.removed);
          newChanges.push(current);
          newChanges.push(next);
          i += 2;
        } else {
          newChanges.push(current);
          i += 1;
        }
      }
      chunk.changes = newChanges;
    }
  }
  return { files: parsed };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
