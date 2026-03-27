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

## Build locally

```bash
npm run build:mac     # macOS .dmg
npm run build:linux   # Linux .AppImage + .deb
npm run build:desktop # build for current platform
```

Output goes to `dist/`.

## Release

Push a version tag to trigger a GitHub Actions build that creates a Release with downloadable installers for macOS and Linux:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Stack

- Electron (desktop shell + local git access)
- React + TypeScript + Vite (UI)
- `simple-git` + `parse-diff` (diff generation/parsing)
