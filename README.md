# Delta

Local-first desktop app for viewing branch diffs in a clean PR/MR-style layout. No network calls, no draft merge requests -- just your local git repo.

## What it does

- Select a local git repository directory.
- Pick a working branch and target branch.
- Render a full-page, GitHub/GitLab-like unified diff.
- Browse changed files in a sidebar with scroll-spy navigation.
- Collapse/expand individual file diffs for focused review.
- Refresh diffs on demand after making local changes.

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
