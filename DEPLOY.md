# Deploy workload-board to GitHub (live + shared edit/view)

This guide gives you a **stable live URL** on GitHub Pages and a **shared database** (Supabase) so everyone sees the same board—not separate copies per browser.

## What you get

| Link | Who | Can do |
|------|-----|--------|
| **View link** (`?mode=view`) | Managers, read-only | See assignments and comments |
| **Edit link** (default, or `?key=…` if you set a secret) | Team | Change cells, comments, title |

GitHub Pages hosts the app (reliable, free). Supabase stores one board for the team (free tier).

---

## Step 1 — Supabase (shared data, ~5 min)

1. Go to [supabase.com](https://supabase.com) → **Start your project** → create a project.
2. **Project Settings → API** — copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
3. **SQL Editor → New query** — paste everything from `supabase/schema.sql` → **Run**.
4. **Database → Replication** — under `supabase_realtime`, enable **`assignments`** and **`board_meta`** (required for instant sync).

Optional: pick a team password for edits only, e.g. `my-team-secret-2026` — you’ll use this as `VITE_EDIT_KEY`.

### Values for `.env` (local) and GitHub Secrets (production)

| Variable | Where to find it |
|----------|------------------|
| `VITE_SUPABASE_URL` | Supabase → **Project Settings** → **API** → **Project URL** (e.g. `https://abcdefgh.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Same page → **Project API keys** → **anon** **public** (long `eyJ...` string) |
| `VITE_EDIT_KEY` | Any secret you choose (optional). Edit URL must include `?key=your-secret` |

Copy `.env.example` to `.env` and paste your values for local `npm run dev`.

---

## Step 2 — GitHub repository

In Terminal:

```bash
source ~/.zshrc
cd ~/workload-board
npm install
```

Create a **new empty repo** on GitHub named `workload-board` (no README).

Then:

```bash
cd ~/workload-board
git init
git add .
git commit -m "Workload board with GitHub Pages and Supabase sync"
git branch -M main
git remote add origin git@github.com:sebastian-DS25/Workload-board.git
git push -u origin main
```

---

## Step 3 — GitHub secrets (required for live sync)

In the repo on GitHub: **Settings → Secrets and variables → Actions → New repository secret**

Add:

| Secret name | Value |
|-------------|--------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `VITE_EDIT_KEY` | (Optional) Your edit password |

---

## Step 4 — Enable GitHub Pages

1. **Settings → Pages**
2. **Build and deployment → Source**: **GitHub Actions**
3. After the first push, open **Actions** — wait for **Deploy to GitHub Pages** to finish (green).

Your site will be:

`https://sebastian-DS25.github.io/Workload-board/`

---

## Step 5 — Share with the team

Open the live site using the **edit** URL (with `?key=…` if you set `VITE_EDIT_KEY`).

Use the buttons:

- **Copy view link** — read-only for stakeholders  
- **Copy edit link** — for people who update the board  

Everyone with the edit link sees the same data; changes save to Supabase automatically.

---

## Local development

```bash
cp .env.example .env.local
# Edit .env.local with your Supabase URL and keys
npm run dev
```

Without `.env.local`, the app still runs but only saves in the browser (local mode).

---

## If something breaks

| Problem | Fix |
|---------|-----|
| Blank page on GitHub | Repo name must match URL path; workflow uses `/workload-board/` |
| “Could not load shared board” | Check secrets, run `schema.sql`, confirm project is not paused |
| Edits don’t sync | Enable Realtime on `boards` in Supabase |
| Can’t edit on live site | Open the **edit** link; if you use `VITE_EDIT_KEY`, URL must include `?key=...` |
| Build fails on GitHub | **Actions** tab → open failed run → read error log |

Redeploy: push any commit to `main`, or **Actions → Deploy to GitHub Pages → Run workflow**.
