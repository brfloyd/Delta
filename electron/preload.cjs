const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("diffViewerAPI", {
  selectRepository: () => ipcRenderer.invoke("repo:select"),
  getBranches: (repoPath) => ipcRenderer.invoke("repo:branches", repoPath),
  getDiff: (payload) => ipcRenderer.invoke("repo:diff", payload),
});
