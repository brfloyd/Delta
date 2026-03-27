const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const simpleGit = require("simple-git");
const parseDiff = require("parse-diff");

const isDev = !app.isPackaged;

function createWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0b1018",
    title: "Local Diff Viewer",
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
