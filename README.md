# Iris Book Finder

Native single-page ebook/audiobook tracking app for Iris.

## Run locally

Open `index.html` directly in a browser.

## Vercel deployment

Set this environment variable in Vercel:

```text
TROVE_API_KEY=your_trove_key
```

The deployed app calls `/api/trove`, so the Trove key stays server-side and is not exposed in browser JavaScript.
