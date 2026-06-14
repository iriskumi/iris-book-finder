# Iris Book Finder

Native single-page ebook/audiobook tracking app for Iris. The app uses Trove for metadata, then guides manual checking across Libby, Hoopla, BorrowBox, Audible AU, and Goodreads.

## Run locally

Open `index.html` directly in a browser.

## Vercel deployment

Set this environment variable in Vercel:

```text
TROVE_API_KEY=your_trove_key
```

The deployed app calls `/api/trove`, so the Trove key stays server-side and is not exposed in browser JavaScript.

## Current platform defaults

- Libby
- Hoopla
- BorrowBox
- Audible AU
- Goodreads
- Trove metadata search

Trove is not counted in manual checking progress. The Manual Check Panel counts Libby, Hoopla, BorrowBox, Audible AU, and Goodreads, so the default progress is `Checked X / 5`.
