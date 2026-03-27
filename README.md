# Delta

AI Generated DIff Viewer 

## What it does

- Select a local git repository directory.
- Pick a working branch and target branch.
- Render a full-page, GitHub/GitLab-like unified diff.

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
