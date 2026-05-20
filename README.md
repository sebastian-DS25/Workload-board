# Workload Board

Team workload assignment board for Inside Sales · Aalborg.

## Quick start (local)

```bash
cd workload-board
npm install
cp .env.example .env.local   # add Supabase keys for team sync
npm run dev
```

## Deploy to GitHub (recommended)

See **[DEPLOY.md](./DEPLOY.md)** for the full guide: GitHub Pages + Supabase + view/edit links.

## Features

- Assign categories per team member
- Per-person comments
- **View link** (read-only) and **edit link** (shared updates)
- Cloud sync when Supabase is configured
- Auto-deploy on push to `main`
