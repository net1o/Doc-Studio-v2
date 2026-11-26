import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppTab,
  CaseEntry,
  GeneratedJournalDoc,
  JournalCheckRow,
  JournalConfig,
  PaperSizeConfig,
  RecordRow,
  ReviewRow,
  ReviewStatus,
} from './types/journal';
import {
  computeReviewStats,
  exportRowsToCsv,
  normalizeJournalCheckDates,
  refreshReviewCaseNumbers,
  runJournalScan,
  triggerFileDownload,
} from './lib/journal/engine';
import {
  JournalMonitorState,
  loadJournalState,
  resetJournalState,
  saveJournalState,
} from './lib/journal/store';
import {
  isSfxEnabled,
  playClickSfx,
  playFilterSfx,
  playSuccessSfx,
  setSfxEnabled,
} from './lib/audio/sfx';
import { BuiltyHeader } from './components/BuiltyHeader';
import { BuiltyHeroBanner } from './components/BuiltyHeroBanner';
import { AnalyzerView } from './components/AnalyzerView';
import { JournalCheckView } from './components/JournalCheckView';
import { ReviewQueueView } from './components/ReviewQueueView';
import { Journal909GeneratorView } from './components/Journal909GeneratorView';
import { DatabaseView } from './components/DatabaseView';
import { RecordsReportView } from './components/RecordsReportView';
import { SettingsView } from './components/SettingsView';
import { BackupToolsView } from './components/BackupToolsView';
import { BuiltyFooter } from './components/BuiltyFooter';

function formatSerial(prefix: string, pad: number, indexOneBased: number): string {
  const num = String(indexOneBased).padStart(Math.max(1, pad), '0');
  return `${prefix}${num}`;
}

function buildGeneratedDocFromReview(
  row: ReviewRow,
  serialNo: string,
  nowIso: string
): GeneratedJournalDoc {
  const caseDisplay = row.caseNo && row.caseNo !== 'NOT FOUND' ? row.caseNo : 'Pending Case Lookup';
  const detailsLines = [
    `Serial: ${serialNo}`,
    `Case No: ${caseDisplay}`,
    `Page No: ${row.pageNo || '—'} | Filing: ${row.dateOfFiling || '—'}`,
  ];

  return {
    id: `gdoc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    reviewId: row.id,
    serialNo,
    journalNo: row.journalNo || '909',
    journalDate: row.journalDate || '26-Nov-2026',
    caseNo: row.caseNo || 'NOT FOUND',
    applicationNo: row.applicationNo,
    title: row.title,
    classNo: row.classNo,
    pageNo: row.pageNo,
    dateOfFiling: row.dateOfFiling,
    applicant: row.applicant,
    agent: row.agent,
    publishingDetails: detailsLines.join('\n'),
    trademarkField: row.applicationNo,
    extraLabel: 'PAGE NO',
    extraValue: row.pageNo
      ? row.caseNo && row.caseNo !== 'NOT FOUND'
        ? `${row.pageNo} (${row.caseNo.split(' - ')[0]})`
        : row.pageNo
      : row.dateOfFiling || '—',
    imageDataUrl: '',
    pdfGenerated: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function buildRecordFromDoc(row: ReviewRow, doc: GeneratedJournalDoc, nowIso: string): RecordRow {
  return {
    id: `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    journalNo: doc.journalNo,
    journalDate: doc.journalDate,
    tmNo: doc.applicationNo,
    caseNo: doc.caseNo,
    classNo: doc.classNo,
    applicant: doc.applicant,
    title: doc.title,
    agent: doc.agent,
    applicationNo: doc.applicationNo,
    dateOfFiling: doc.dateOfFiling,
    matchedTerm: row.matchedTerm,
    matchType: row.matchType,
    decision: row.decision,
    remarks: `Serial ${doc.serialNo} · Journal ${doc.journalNo} Legal 8.5x14`,
    docId: doc.id,
    pdfReady: doc.pdfGenerated,
    createdAt: nowIso,
    pageNo: doc.pageNo,
  };
}

export default function App() {
  const [state, setState] = useState<JournalMonitorState>(() => loadJournalState());
  const [activeTab, setActiveTab] = useState<AppTab>('analyzer');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(() => {
    const initial = loadJournalState();
    return initial.generatedDocs[0]?.id || null;
  });
  const [toast, setToast] = useState<{ kind: 'info' | 'error'; message: string } | null>(null);
  const [sfxEnabled, setSfxEnabledState] = useState<boolean>(() => isSfxEnabled());
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (message: string, kind: 'info' | 'error' = 'info') => {
    setToast({ message, kind });
    if (kind === 'info') {
      playSuccessSfx();
    }
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    saveJournalState(state);
  }, [state]);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('button');
      if (!btn || btn.disabled) return;
      const sfxType = btn.getAttribute('data-sfx');
      if (sfxType === 'none') return;
      if (sfxType === 'filter') {
        playFilterSfx();
      } else {
        playClickSfx();
      }
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, []);

  useEffect(() => {
    const shortcutMap: Record<string, AppTab> = {
      '1': 'analyzer',
      '2': 'journalcheck',
      '3': 'review',
      '4': 'generator',
      '5': 'database',
      '6': 'records',
      '7': 'settings',
      '8': 'backup',
    };

    const handleGlobalShortcut = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      const targetTab = shortcutMap[e.key];
      if (!targetTab) return;
      e.preventDefault();
      setActiveTab(targetTab);
      playFilterSfx();
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, []);

  const handleToggleSfx = () => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    setSfxEnabledState(next);
    if (next) {
      playSuccessSfx();
    }
  };

  const currentStats = useMemo(
    () => computeReviewStats(state.reviewRows, state.config.journalNo),
    [state.reviewRows, state.config.journalNo]
  );

  const allTimeStats = useMemo(
    () => computeReviewStats(state.reviewRows),
    [state.reviewRows]
  );

  const handleUpdateConfig = (nextConfig: JournalConfig) => {
    setState((prev) => ({ ...prev, config: nextConfig }));
  };

  const handleUpdateJournalRows = (nextRows: JournalCheckRow[]) => {
    setState((prev) => ({ ...prev, journalRows: nextRows }));
  };

  const handleNormalizeDates = () => {
    const { rows, changed, failed } = normalizeJournalCheckDates(state.journalRows);
    setState((prev) => ({ ...prev, journalRows: rows }));
    showToast(
      `Date normalization complete: ${changed} updated to dd-MMM-yy${failed > 0 ? `, ${failed} unrecognized` : ''}.`
    );
  };

  const handleRunScan = () => {
    const { newRows, skippedDuplicate, totalScanned } = runJournalScan(
      state.config,
      state.journalRows,
      state.reviewRows
    );

    if (newRows.length > 0) {
      setState((prev) => ({
        ...prev,
        reviewRows: [...newRows, ...prev.reviewRows],
      }));
      setActiveTab('review');
      showToast(
        `Scan complete (${totalScanned} rows): ${newRows.length} new matches added to Review${
          skippedDuplicate > 0 ? `, ${skippedDuplicate} duplicates skipped` : ''
        }.`
      );
    } else {
      setActiveTab('review');
      showToast(
        `Scan complete (${totalScanned} rows): 0 new matches${
          skippedDuplicate > 0 ? ` (${skippedDuplicate} already in Review)` : ''
        }.`
      );
    }
  };

  const handleUpdateReviewRow = (id: string, patch: Partial<ReviewRow>) => {
    setState((prev) => ({
      ...prev,
      reviewRows: prev.reviewRows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const handleBulkApplyStatusByAppNo = (
    applicationNo: string,
    status: ReviewStatus,
    visibleRowIds: string[]
  ) => {
    const targetApp = applicationNo.trim().toLowerCase();
    if (!targetApp) return;
    const visibleSet = new Set(visibleRowIds);
    let updatedCount = 0;

    setState((prev) => ({
      ...prev,
      reviewRows: prev.reviewRows.map((r) => {
        if (visibleSet.has(r.id) && r.applicationNo.trim().toLowerCase() === targetApp) {
          updatedCount++;
          return { ...r, status };
        }
        return r;
      }),
    }));

    showToast(
      `Applied status "${status}" to ${updatedCount} row(s) matching App No ${applicationNo}.`
    );
  };

  const handleMarkIssuesMailmerge = () => {
    let count = 0;
    setState((prev) => ({
      ...prev,
      reviewRows: prev.reviewRows.map((r) => {
        if (r.decision === 'ISSUE - OPPOSE' && r.status === 'REVIEW') {
          count++;
          return { ...r, status: 'MAILMERGE' };
        }
        return r;
      }),
    }));
    showToast(
      count > 0
        ? `Marked ${count} ISSUE - OPPOSE row(s) as MAILMERGE.`
        : 'No ISSUE - OPPOSE rows with REVIEW status found.'
    );
  };

  const handleGenerateDocsFromMailmerge = () => {
    const readyRows = state.reviewRows.filter(
      (r) => r.status === 'MAILMERGE' && !r.generatedDocId
    );
    if (readyRows.length === 0) {
      showToast('No Review rows with status MAILMERGE waiting for generation.', 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    let serialCounter = state.generatedDocs.length;
    const createdDocs: GeneratedJournalDoc[] = [];
    const createdRecords: RecordRow[] = [];
    const docByReviewId: Record<string, GeneratedJournalDoc> = {};

    for (const row of readyRows) {
      serialCounter++;
      const serialNo = formatSerial(
        state.config.serialPrefix || 'PB-',
        state.config.serialPad || 3,
        serialCounter
      );
      const doc = buildGeneratedDocFromReview(row, serialNo, nowIso);
      createdDocs.push(doc);
      createdRecords.push(buildRecordFromDoc(row, doc, nowIso));
      docByReviewId[row.id] = doc;
    }

    setState((prev) => ({
      ...prev,
      generatedDocs: [...createdDocs, ...prev.generatedDocs],
      records: [...createdRecords, ...prev.records],
      reviewRows: prev.reviewRows.map((r) => {
        const doc = docByReviewId[r.id];
        if (!doc) return r;
        return {
          ...r,
          status: 'GENERATED',
          generatedDocId: doc.id,
          generatedAt: nowIso,
        };
      }),
    }));

    setSelectedDocId(createdDocs[0].id);
    setActiveTab('generator');
    showToast(`Generated ${createdDocs.length} Journal 909 Legal (8.5×14) document(s).`);
  };

  const handleOpenDocInGenerator = (row: ReviewRow) => {
    if (row.generatedDocId) {
      const exists = state.generatedDocs.some((d) => d.id === row.generatedDocId);
      if (exists) {
        setSelectedDocId(row.generatedDocId);
        setActiveTab('generator');
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const serialNo = formatSerial(
      state.config.serialPrefix || 'PB-',
      state.config.serialPad || 3,
      state.generatedDocs.length + 1
    );
    const doc = buildGeneratedDocFromReview(row, serialNo, nowIso);
    const rec = buildRecordFromDoc(row, doc, nowIso);

    setState((prev) => ({
      ...prev,
      generatedDocs: [doc, ...prev.generatedDocs],
      records: [rec, ...prev.records],
      reviewRows: prev.reviewRows.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: 'GENERATED',
              generatedDocId: doc.id,
              generatedAt: nowIso,
            }
          : r
      ),
    }));

    setSelectedDocId(doc.id);
    setActiveTab('generator');
    showToast(`Merged ${row.title || row.applicationNo} into Journal 909 (${serialNo}).`);
  };

  const handleCreateBlankDoc = () => {
    const nowIso = new Date().toISOString();
    const serialNo = formatSerial(
      state.config.serialPrefix || 'PB-',
      state.config.serialPad || 3,
      state.generatedDocs.length + 1
    );
    const blankDoc: GeneratedJournalDoc = {
      id: `gdoc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      reviewId: null,
      serialNo,
      journalNo: state.config.journalNo || '909',
      journalDate: state.config.journalDate || '26-Nov-2026',
      caseNo: '',
      applicationNo: '',
      title: 'NEW TRADEMARK TITLE',
      classNo: '9',
      pageNo: '',
      dateOfFiling: '',
      applicant: '',
      agent: '',
      publishingDetails: `Serial: ${serialNo}\nJournal: ${state.config.journalNo || '909'}\nDate: ${state.config.journalDate || '26-Nov-2026'}`,
      trademarkField: '',
      extraLabel: 'PAGE NO',
      extraValue: '',
      imageDataUrl: '',
      pdfGenerated: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setState((prev) => ({
      ...prev,
      generatedDocs: [blankDoc, ...prev.generatedDocs],
    }));
    setSelectedDocId(blankDoc.id);
    setActiveTab('generator');
    showToast(`Created blank Journal 909 sheet (${serialNo}).`);
  };

  const handleUpdateGeneratedDoc = (id: string, patch: Partial<GeneratedJournalDoc>) => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      generatedDocs: prev.generatedDocs.map((d) =>
        d.id === id ? { ...d, ...patch, updatedAt: nowIso } : d
      ),
    }));
  };

  const handleMarkPdfGenerated = (docId: string) => {
    setState((prev) => ({
      ...prev,
      generatedDocs: prev.generatedDocs.map((d) =>
        d.id === docId ? { ...d, pdfGenerated: true, updatedAt: new Date().toISOString() } : d
      ),
      reviewRows: prev.reviewRows.map((r) =>
        r.generatedDocId === docId ? { ...r, generatedPdfReady: true } : r
      ),
      records: prev.records.map((rec) =>
        rec.docId === docId ? { ...rec, pdfReady: true } : rec
      ),
    }));
  };

  const handleOpenGeneratedDocById = (docId: string) => {
    if (state.generatedDocs.some((d) => d.id === docId)) {
      setSelectedDocId(docId);
      setActiveTab('generator');
    } else {
      showToast('Document snapshot was not found in local store.', 'error');
    }
  };

  const handleResetSampleData = () => {
    const fresh = resetJournalState();
    setState(fresh);
    setSelectedDocId(fresh.generatedDocs[0]?.id || null);
    setActiveTab('analyzer');
    showToast('Workspace reset to default Journal 909 sample data.');
  };

  const handleClearWatchlist = () => {
    const clearedTotal = state.config.keywords.length + state.config.tmNumbers.length;
    setState((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        keywords: [],
        tmNumbers: [],
      },
    }));
    showToast(`Watchlist cleared (${clearedTotal} criteria removed).`);
  };

  const handleExportReport = () => {
    const rowsSource =
      state.records.length > 0
        ? state.records.map((r) => [
            r.journalNo,
            r.journalDate,
            r.applicationNo,
            r.caseNo,
            r.title,
            r.classNo,
            r.matchedTerm,
            r.matchType,
            r.decision,
            r.pdfReady ? 'PDF READY' : 'DOC CREATED',
            r.remarks,
          ])
        : state.reviewRows.map((r) => [
            r.journalNo,
            r.journalDate,
            r.applicationNo,
            r.caseNo,
            r.title,
            r.classNo,
            r.matchedTerm,
            r.matchType,
            r.decision,
            r.status,
            r.applicant,
          ]);

    const csv = exportRowsToCsv(
      [
        'JOURNAL NO',
        'JOURNAL DATE',
        'APPLICATION NO',
        'CASE NO',
        'TITLE',
        'CLASS',
        'MATCHED TERM',
        'MATCH TYPE',
        'DECISION',
        'STATUS',
        'NOTES / APPLICANT',
      ],
      rowsSource
    );
    const jNo = (state.config.journalNo || '909').replace(/[^a-zA-Z0-9_-]+/g, '_');
    triggerFileDownload(csv, `Journal_${jNo}_Monitoring_Report.csv`, 'text/csv;charset=utf-8');
    showToast(`Exported Journal ${state.config.journalNo || '909'} monitoring report (${rowsSource.length} rows).`);
  };

  const watchlistCount = state.config.keywords.length + state.config.tmNumbers.length;
  const activeContextCount = useMemo(() => {
    switch (activeTab) {
      case 'analyzer':
        return watchlistCount;
      case 'journalcheck':
        return state.journalRows.length;
      case 'review':
        return state.reviewRows.length;
      case 'generator':
        return state.generatedDocs.length;
      case 'database':
        return state.config.caseEntries.length;
      case 'records':
        return state.records.length;
      case 'settings':
        return watchlistCount + state.config.caseEntries.length;
      case 'backup':
        return (
          state.journalRows.length +
          state.reviewRows.length +
          state.records.length +
          state.config.caseEntries.length
        );
      default:
        return 0;
    }
  }, [
    activeTab,
    watchlistCount,
    state.journalRows.length,
    state.reviewRows.length,
    state.generatedDocs.length,
    state.config.caseEntries.length,
    state.records.length,
  ]);

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#111111] flex flex-col">
      <BuiltyHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onRunScan={handleRunScan}
        activeContextCount={activeContextCount}
        watchlistCount={watchlistCount}
        journalRowsCount={state.journalRows.length}
        reviewCount={state.reviewRows.length}
        docsCount={state.generatedDocs.length}
        databaseCount={state.config.caseEntries.length}
        recordsCount={state.records.length}
        sfxEnabled={sfxEnabled}
        onToggleSfx={handleToggleSfx}
      />

      <BuiltyHeroBanner
        journalNo={state.config.journalNo}
        journalDate={state.config.journalDate}
        activeTab={activeTab}
        onOpenGenerator={() => setActiveTab('generator')}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:m-0 print:max-w-none">
        {toast && (
          <div
            role="status"
            className={`no-print mb-6 px-4 py-3 border text-xs font-semibold flex items-center justify-between gap-4 ${
              toast.kind === 'error'
                ? 'bg-red-50 border-red-300 text-red-900'
                : 'bg-[#fffef0] border-[#111111] text-[#111111]'
            }`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="underline font-bold hover:opacity-75 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'analyzer' && (
          <AnalyzerView
            config={state.config}
            stats={currentStats}
            journalRowCount={state.journalRows.length}
            onUpdateConfig={handleUpdateConfig}
            onRunScan={handleRunScan}
            onGoToTab={setActiveTab}
            onRefreshReviewCases={(entries: CaseEntry[]) => {
              const { rows, updatedCount } = refreshReviewCaseNumbers(state.reviewRows, entries);
              if (updatedCount > 0) {
                setState((prev) => ({ ...prev, reviewRows: rows }));
                showToast(`Updated Case No on ${updatedCount} Review Queue row(s).`);
              }
            }}
            onNotify={(msg: string) => showToast(msg)}
          />
        )}

        {activeTab === 'journalcheck' && (
          <JournalCheckView
            rows={state.journalRows}
            onChangeRows={handleUpdateJournalRows}
            onNormalizeDates={handleNormalizeDates}
            onRunScan={handleRunScan}
            onNotify={(msg: string) => showToast(msg)}
          />
        )}

        {activeTab === 'review' && (
          <ReviewQueueView
            rows={state.reviewRows}
            onUpdateRow={handleUpdateReviewRow}
            onBulkApplyStatusByAppNo={handleBulkApplyStatusByAppNo}
            onMarkIssuesMailmerge={handleMarkIssuesMailmerge}
            onGenerateDocsFromMailmerge={handleGenerateDocsFromMailmerge}
            onOpenDocInGenerator={handleOpenDocInGenerator}
          />
        )}

        {activeTab === 'generator' && (
          <Journal909GeneratorView
            docs={state.generatedDocs}
            selectedDocId={selectedDocId}
            paperSize={state.config.paperSize}
            activeTab={activeTab}
            watchlistCount={watchlistCount}
            onSelectTab={setActiveTab}
            onClearWatchlist={handleClearWatchlist}
            onExportReport={handleExportReport}
            onChangePaperSize={(nextPaper: PaperSizeConfig) =>
              handleUpdateConfig({ ...state.config, paperSize: nextPaper })
            }
            onSelectDoc={setSelectedDocId}
            onUpdateDoc={handleUpdateGeneratedDoc}
            onCreateBlankDoc={handleCreateBlankDoc}
            onMarkPdfGenerated={handleMarkPdfGenerated}
          />
        )}

        {activeTab === 'database' && (
          <DatabaseView
            config={state.config}
            onUpdateConfig={handleUpdateConfig}
            onRefreshReviewCases={(entries: CaseEntry[]) => {
              const { rows, updatedCount } = refreshReviewCaseNumbers(state.reviewRows, entries);
              if (updatedCount > 0) {
                setState((prev) => ({ ...prev, reviewRows: rows }));
                showToast(`Updated Case No on ${updatedCount} Review Queue row(s).`);
              } else {
                showToast('All Review Queue rows already match current Database records.');
              }
            }}
            onNotify={(msg: string) => showToast(msg)}
          />
        )}

        {activeTab === 'records' && (
          <RecordsReportView
            records={state.records}
            currentJournalNo={state.config.journalNo || '909'}
            currentStats={currentStats}
            allTimeStats={allTimeStats}
            onOpenGeneratedDoc={handleOpenGeneratedDocById}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            config={state.config}
            onUpdateConfig={handleUpdateConfig}
            onResetSampleData={handleResetSampleData}
            onNotify={(msg: string) => showToast(msg)}
            onOpenDatabase={() => setActiveTab('database')}
          />
        )}

        {activeTab === 'backup' && (
          <BackupToolsView
            config={state.config}
            journalRows={state.journalRows}
            reviewRows={state.reviewRows}
            records={state.records}
            onResetSampleData={handleResetSampleData}
          />
        )}
      </main>

      <BuiltyFooter
        onSelectTab={setActiveTab}
        onScrollTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
    </div>
  );
}
