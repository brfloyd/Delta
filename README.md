# Local Diff Viewer

Desktop app for viewing branch diffs locally in a clean PR/MR-style layout.

## What it does

- Select a local git repository directory.
- Pick a working branch and target branch.
- Render a full-page, GitHub/GitLab-like unified diff.
- Show changed files in a left sidebar.
- Jump to file sections by clicking filenames.

No runtime network calls are made by the app. It only reads local git state.

## Run

```bash
npm install
npm run dev:desktop
```

## Build desktop app

```bash
npm run build:desktop
```

## Stack

- Electron (desktop shell + local git access)
- React + TypeScript + Vite (UI)
- `simple-git` + `parse-diff` (diff generation/parsing)
