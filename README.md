# Brandex Law Associate — Database & Journal Monitor System

Interactive IP Law Firm trademark journal monitoring, 24-column case database synchronization, monthly journal record tracking, and Legal 8.5×14 (`Journal 909`) publication document generator.

## Capabilities

- **Dashboard & Watchlist**: Configure Monthly Journal Number & Date, word/contains keyword match mode, bulk watchlist import/merge, and Protection Summary metrics.
- **Cases Database (24 Columns)**: Full 24-column schema (`ID`, `DATE`, `TYPE`, `CLIENT CODE`, `CASE NUMBER`, `CLIENT NAME`, `APPLICATION NAME`, `TM/CPR NUMBER`, `CLASS`, `STATUS`, `SUB STATUS`, `CASE TYPE`, `AGENT`, `OFF NOTE`, `NOTES`, `TM5`–`TM56`, `JOURNAL NUMBER`, `JOURNAL DATE`, `LAST MODIFIED`, `IMAGE`), default recent-date descending sort, single-record form mapped to all columns, multi-select bulk delete, and live Google Sheet sync & analytics (`1yu27k_3Z6cCJmcnQI52z1dIC52Zi9ZxaKlo9wJiNFiQ`).
- **JournalCheck Input**: Edit, paste CSV/TSV or raw Trademark Journal text (`ConvertJournal2`), deduplicate rows, and normalize filing dates (`dd-MMM-yy`).
- **Monthly Review Queue**: Filter matches by Monthly Journal Number, Match Type, or Decision (`PENDING REVIEW`, `ISSUE - OPPOSE`, `NO ISSUE - CLEAR`), bulk-apply status by Application Number, and batch-generate documents.
- **Doc Gen & PDF Print Preview**: Live editable Journal 909 publication sheet supporting Legal 8.5×14, Letter, A4, A5, A3, Tabloid, Executive, and custom paper sizes, with a print-ready **PDF Preview modal**, standalone HTML export, and Word export.
- **Records & Monthly Journal Archive**: Filterable Records Ledger organized by Monthly Journal Number (`byJournal` breakdown) plus CSV/JSON backup exports in `Backup`.

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
