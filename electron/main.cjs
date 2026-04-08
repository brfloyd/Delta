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

function getChangeText(change) {
  return change.content.slice(1);
}

function scoreLinePair(left, right) {
  if (left === right) return 1;

  const leftTrimmed = left.trim();
  const rightTrimmed = right.trim();
  if (!leftTrimmed.length || !rightTrimmed.length) {
    return leftTrimmed === rightTrimmed ? 0.9 : 0;
  }

  const wordParts = Diff.diffWordsWithSpace(left, right);
  let shared = 0;

  for (const part of wordParts) {
    if (!part.added && !part.removed) {
      shared += part.value.length;
    }
  }

  if (shared === 0) return 0;

  const maxLen = Math.max(left.length, right.length, 1);
  const minLen = Math.min(left.length, right.length);
  const sharedRatio = shared / maxLen;
  const lengthRatio = minLen / maxLen;

  return sharedRatio * 0.85 + lengthRatio * 0.15;
}

function buildInlineParts(left, right) {
  const wordParts = Diff.diffWordsWithSpace(left, right);
  const leftParts = [];
  const rightParts = [];
  let pendingRemoved = "";
  let pendingAdded = "";

  const flushChangedPair = () => {
    if (!pendingRemoved && !pendingAdded) return;

    const charParts = Diff.diffChars(pendingRemoved, pendingAdded);
    for (const part of charParts) {
      if (!part.added) {
        leftParts.push({
          value: part.value,
          removed: !!part.removed,
        });
      }
      if (!part.removed) {
        rightParts.push({
          value: part.value,
          added: !!part.added,
        });
      }
    }

    pendingRemoved = "";
    pendingAdded = "";
  };

  for (const part of wordParts) {
    if (part.removed) {
      pendingRemoved += part.value;
      continue;
    }
    if (part.added) {
      pendingAdded += part.value;
      continue;
    }

    flushChangedPair();
    leftParts.push({ value: part.value });
    rightParts.push({ value: part.value });
  }

  flushChangedPair();

  return { leftParts, rightParts };
}

function annotateReplacementRun(deletions, additions) {
  const available = new Set(additions.map((_, index) => index));

  for (let delIndex = 0; delIndex < deletions.length; delIndex += 1) {
    const deletion = deletions[delIndex];
    const deletionText = getChangeText(deletion);
    let bestAddIndex = -1;
    let bestScore = 0;

    for (const addIndex of available) {
      const addition = additions[addIndex];
      const additionText = getChangeText(addition);
      const similarity = scoreLinePair(deletionText, additionText);
      const distancePenalty = Math.abs(delIndex - addIndex) * 0.03;
      const score = similarity - distancePenalty;

      if (score > bestScore) {
        bestScore = score;
        bestAddIndex = addIndex;
      }
    }

    if (bestAddIndex === -1 || bestScore < 0.35) {
      continue;
    }

    const addition = additions[bestAddIndex];
    const { leftParts, rightParts } = buildInlineParts(
      deletionText,
      getChangeText(addition),
    );

    deletion.parts = leftParts;
    addition.parts = rightParts;
    available.delete(bestAddIndex);
  }
}

function annotateChunkChanges(changes) {
  let index = 0;

  while (index < changes.length) {
    if (changes[index].type !== "del") {
      index += 1;
      continue;
    }

    const deletions = [];
    while (index < changes.length && changes[index].type === "del") {
      deletions.push(changes[index]);
      index += 1;
    }

    const additions = [];
    let addIndex = index;
    while (addIndex < changes.length && changes[addIndex].type === "add") {
      additions.push(changes[addIndex]);
      addIndex += 1;
    }

    if (additions.length > 0) {
      annotateReplacementRun(deletions, additions);
      index = addIndex;
    }
  }
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
      annotateChunkChanges(chunk.changes);
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
