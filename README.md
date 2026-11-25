# GeoRakshak – Vercel Static Showcase

Self-contained static OpenLayers + Vite showcase of Sentinel-2 L2A change and encroachment alerts (no backend server required).

## Deploy to Vercel

### Option A: Vercel CLI (from this folder)
```bash
cd vercel-static
npm install
npm run build
npx vercel --prod
```

### Option B: GitHub + Vercel Dashboard
1. Push this folder (or repo) to GitHub.
2. In Vercel → **Add New Project** → select the repo.
3. If deploying from the full repository, set **Root Directory** to `vercel-static`.
4. Keep **Framework Preset** = `Vite`, **Build Command** = `npm run build`, **Output Directory** = `dist`, and click **Deploy**.
