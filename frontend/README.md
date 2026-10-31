# Brightloop workspace

React + TypeScript + Vite. See the [project README](../README.md) for the full workflow and backend setup.

```sh
npm ci
npm run dev
```

UI: http://localhost:3000. Vite proxies `/api/v1` to http://localhost:8000. The backend must be running; failed requests produce real errors and never fall back to mock data.

`npm run build` runs the TypeScript check and creates a production bundle in `dist/`. Pages are loaded on demand. Set `VITE_API_URL` at build time to use another API origin.

Currency is INR (`src/utils/currency.ts`). Run `npm test` for the rupee-formatting checks.
