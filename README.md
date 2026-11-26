# Journal Monitor & Doc Generator

Trademark journal analyzer, watchlist scanner, review queue, and Legal 8.5×14 (`Journal 909`) document generator ported from the Google Apps Script monitoring workflow into an interactive web workspace.

## Capabilities

- **Dashboard & Watchlist (`Analyzer`)**: Configure Journal No, Journal Date, word/contains keyword match mode, watchlist keywords, and 6-digit TM numbers with Protection Summary metrics.
- **JournalCheck Input**: Edit, paste CSV/TSV, upload CSV/JSON, and normalize filing dates (`dd-MMM-yy`) across `Application No`, `Title`, `Class`, `Applicant Name and Address`, `Agent Name and Address`, `Date of Filing`, and `Page No`.
- **Scan Engine**: Matches `JournalCheck` rows against 6-digit TM numbers and keywords, resolves Case Numbers, deduplicates matches, and populates the `Review` queue.
- **Review & Mailmerge**: Set `Decision` (`PENDING REVIEW`, `ISSUE - OPPOSE`, `NO ISSUE - CLEAR`) and `Status` (`REVIEW`, `MAILMERGE`, `GENERATED`), then batch-generate Journal 909 documents.
- **Journal 909 Legal (8.5×14) Generator**: Live editable Legal-size publication sheet (`Orbitron`, `Chakra Petch`, `Exo 2`, SVG corner frame, `PUBLISHING DETAILS`, `APPLICATION DETAILS` table, artwork `IMAGE` zone, and footer), with standalone HTML export, Word export, and exact `8.5in × 14in` Print / PDF output.
- **Records, Report & Backup**: Full `Records` log, per-journal analytics report, and CSV/JSON backup downloads.

## Local Development

```bash
npm install
npm run dev
```

Build & typecheck:

```bash
npm run lint
npm run build
```
