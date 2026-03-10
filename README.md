# NordLayer Connections Analyzer

A client-side React app for analyzing NordLayer connections exports.

## What it does

- Upload a NordLayer `connections.csv` export and find unique users connected in the last **X** days.
- Optionally upload `members.csv` and identify members who have **not** connected in the same window.
- Search and sort both result tables before exporting.
- Persist uploaded CSV files and core settings in browser localStorage.
- Export results to CSV.

All analysis runs in the browser. No server-side processing.

## Supported inputs

### Connections CSV (required)
Expected columns:

- `NAME`
- `EMAIL`
- `CONNECTED`

Example `CONNECTED` format:

- `2026-03-10 08:45:33 UTC`

### Members CSV (optional)
Expected columns:

- `Member name`
- `Email`
- `Status`

## Matching rules

- Primary identity key: normalized email (lowercase + trimmed, valid email format).
- Fallback identity key: normalized name when email is missing or malformed.
- Reference date is the **latest** `CONNECTED` timestamp in the uploaded connections file.
- A user/member is considered connected in the last X days when:
  - `lastConnectedAt >= referenceDate - X days`

## Member scope

When members file is uploaded, you can switch between:

- `Active only`
- `All members`

## Local persistence

The app stores the following in browser localStorage:

- Uploaded `connections.csv` (file name + file content)
- Uploaded `members.csv` (file name + file content)
- Settings: lookback days and member scope

This allows users to refresh or reopen the page without re-uploading unchanged files.

## Matching warnings

If members are uploaded and some members cannot be matched to any user identity in the current connections file, the app shows a warning and a summary metric (`Members Without Match`).

## Local development

```bash
npm install
npm run dev
```

Run tests:

```bash
npm run test
```

Create production build:

```bash
npm run build
```

## GitHub Pages deployment

Deployment is automated via `.github/workflows/deploy.yml`:

- Push to `main`
- Workflow runs tests + build
- `dist/` is published to GitHub Pages

The app's Vite base path is derived from `GITHUB_REPOSITORY` in CI.

## Sample files

Sample fixtures are included:

- `input/connections.csv`
- `input/members.csv`

## License

MIT
