# Together Budget

## What it does

Together Budget is a local browser-only, read-only YNAB-style dashboard that combines two selected YNAB plans through manual category mappings.

## Privacy and data handling

The Personal Access Token stays in React memory for the current tab only and is never persisted by the app. Tests use mocked data only. Category mappings and the selected theme are stored in browser `localStorage`, under `ynabTogether.categoryMapping.v1` and `ynabTogether.theme.v1` keys.

## Prerequisites

- Node.js 20 or newer
- npm
- A YNAB Personal Access Token for live local use

## Install

```sh
npm install
```

## Run locally

```sh
npm run dev
```

Open the Vite URL, paste your Personal Access Token, select two plans, choose a shared month, and create or import mappings.

## Test with mocked data

```sh
npm run test:run
```

No real YNAB token or data is needed.

## Build

```sh
npm run build
```

## Mapping backup

Use Export mapping in the app to save a mapping backup file. Use Import mapping to restore a mapping for the same selected plan pair. Do not commit private exported mappings.

## Progress tracking

Future agents and developers must read and update `TASKS.md` before and after each implementation step.
