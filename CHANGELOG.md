# Changelog

All notable changes to the **Brandex Law Associate — Database & Journal Monitor System** are recorded in this file.

## [2.2.0] - 2026-11-26

### Added & Changed
- **IP Law Firm Branding**: Rebranded workspace header, hero banner, HTML metadata, and footer to **Brandex Law Associate** with subheading **Database & Journal Monitor System**, and renamed `Analyzer` to **Dashboard**.
- **24-Column Cases Database & Google Sheet Analysis**: Expanded `CaseEntry` and `DatabaseView` to display all 24 columns (`ID` through `IMAGE`), mapped the Add Single Case Record form to all columns, set default sorting to recent `DATE` descending, and added live Google Sheet analysis & Watchlist sync (`1yu27k_3Z6cCJmcnQI52z1dIC52Zi9ZxaKlo9wJiNFiQ`).
- **Monthly Journal Tracking**: Added Monthly Journal Edition switcher on Dashboard and per-Journal Number archive breakdown & filtering in `ReviewQueueView` and `RecordsReportView`.
- **Print-Ready PDF Preview Modal**: Added an interactive PDF Preview modal in `Journal909GeneratorView` scaled to standard or custom paper dimensions with zoom controls and direct iframe print/PDF export.

## [0.8.0] - 2026-11-26

### Added
- Document Studio initial workspace, watchlist scanner, JournalCheck importer, Review Queue, and Journal 909 Legal (8.5×14) generator.
