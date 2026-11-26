import { useState } from 'react';
import { FileText } from 'lucide-react';
import { JournalStats, RecordRow } from '../types/journal';

interface RecordsReportViewProps {
  records: RecordRow[];
  currentJournalNo: string;
  currentStats: JournalStats;
  allTimeStats: JournalStats;
  onOpenGeneratedDoc: (docId: string) => void;
}

export function RecordsReportView({
  records,
  currentJournalNo,
  currentStats,
  allTimeStats,
  onOpenGeneratedDoc,
}: RecordsReportViewProps) {
  const [search, setSearch] = useState('');

  const filtered = records.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.applicationNo.toLowerCase().includes(q) ||
      r.caseNo.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.matchedTerm.toLowerCase().includes(q)
    );
  });

  const decisionTotal = Math.max(1, allTimeStats.total);
  const matchTotal = Math.max(1, allTimeStats.tmMatches + allTimeStats.keywordMatches);

  return (
    <div className="space-y-8">
      {/* Analytics Report Section (Replicates generateReport()) */}
      <section className="space-y-4" aria-label="Monitoring report">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">
            Trademark Journal Monitoring Report
          </h2>
          <p className="text-xs text-[#555a66] mt-1">
            Current Journal (No. {currentJournalNo}) vs. All-Time summary, Decision breakdown, and Match Type distribution.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-[#e2e4ea] p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-[#111111] uppercase tracking-wider border-b border-[#eceef2] pb-2.5">
              Current Journal (No. {currentJournalNo}) vs All-Time
            </h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#e2e4ea] text-[#555a66]">
                  <th className="py-2 text-left font-bold">Metric</th>
                  <th className="py-2 text-right font-bold">Journal {currentJournalNo}</th>
                  <th className="py-2 text-right font-bold">All-Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceef2] tabular-nums">
                <tr>
                  <td className="py-2 text-[#374151]">Total Matches</td>
                  <td className="py-2 text-right font-extrabold text-[#111111]">{currentStats.total}</td>
                  <td className="py-2 text-right text-[#555a66]">{allTimeStats.total}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[#374151]">TM Matches</td>
                  <td className="py-2 text-right font-extrabold text-[#111111]">{currentStats.tmMatches}</td>
                  <td className="py-2 text-right text-[#555a66]">{allTimeStats.tmMatches}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[#374151]">Keyword Matches</td>
                  <td className="py-2 text-right font-extrabold text-[#111111]">{currentStats.keywordMatches}</td>
                  <td className="py-2 text-right text-[#555a66]">{allTimeStats.keywordMatches}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[#374151]">Issue / Oppose</td>
                  <td className="py-2 text-right font-extrabold text-[#b45309]">{currentStats.issue}</td>
                  <td className="py-2 text-right font-bold text-[#b45309]">{allTimeStats.issue}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[#374151]">Docs / PDFs Generated</td>
                  <td className="py-2 text-right font-extrabold text-[#111111]">
                    {currentStats.docsGenerated} / {currentStats.pdfsGenerated}
                  </td>
                  <td className="py-2 text-right text-[#555a66]">
                    {allTimeStats.docsGenerated} / {allTimeStats.pdfsGenerated}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Visual Proportion Breakdowns */}
          <div className="bg-white border border-[#e2e4ea] p-5 space-y-5">
            <h3 className="text-sm font-extrabold text-[#111111] uppercase tracking-wider border-b border-[#eceef2] pb-2.5">
              Decision &amp; Match Type Breakdown
            </h3>

            <div className="space-y-3">
              {[
                { label: 'Pending Review', val: allTimeStats.pending, color: 'bg-[#9ca3af]' },
                { label: 'Issue / Oppose', val: allTimeStats.issue, color: 'bg-[#eab308]' },
                { label: 'No Issue / Clear', val: allTimeStats.clear, color: 'bg-[#16a34a]' },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs tabular-nums">
                    <span className="text-[#374151] font-medium">{item.label}</span>
                    <span className="font-bold text-[#111111]">
                      {item.val} ({Math.round((item.val / decisionTotal) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[#eceef2]">
                    <div
                      className={`h-full ${item.color}`}
                      style={{ width: `${Math.round((item.val / decisionTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#eceef2] space-y-3">
              {[
                { label: 'TM Number Matches', val: allTimeStats.tmMatches, color: 'bg-[#111111]' },
                { label: 'Keyword Matches', val: allTimeStats.keywordMatches, color: 'bg-[#eab308]' },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs tabular-nums">
                    <span className="text-[#374151] font-medium">{item.label}</span>
                    <span className="font-bold text-[#111111]">
                      {item.val} ({Math.round((item.val / matchTotal) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[#eceef2]">
                    <div
                      className={`h-full ${item.color}`}
                      style={{ width: `${Math.round((item.val / matchTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Records Ledger */}
      <section className="space-y-4" aria-label="Generated records log">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-[#111111]">Records Ledger</h2>
            <p className="text-xs text-[#555a66]">
              Archive of generated Journal 909 documents and PDF readiness.
            </p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter records by App No, Case No, or Title…"
            className="w-full sm:w-80 bg-white border border-[#cbd0da] px-3 py-2 text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
          />
        </div>

        <div className="bg-white border border-[#e2e4ea] overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-[#111111] text-white text-[11.5px] font-extrabold uppercase tracking-wider">
                <th className="py-2.5 px-3">Journal</th>
                <th className="py-2.5 px-3">TM / App No</th>
                <th className="py-2.5 px-3">Case No</th>
                <th className="py-2.5 px-3">Title</th>
                <th className="py-2.5 px-3 text-center">Class</th>
                <th className="py-2.5 px-3">Decision</th>
                <th className="py-2.5 px-3">PDF</th>
                <th className="py-2.5 px-3 text-right">Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eceef2] text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[#555a66]">
                    No generated records yet. Mark Review rows as MAILMERGE and click Generate Docs.
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#f7f8fa]">
                    <td className="py-2.5 px-3 font-mono tabular-nums text-[#555a66]">
                      {rec.journalNo} ({rec.journalDate})
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#111111] tabular-nums">
                      {rec.applicationNo}
                    </td>
                    <td className="py-2.5 px-3 text-[#374151]">{rec.caseNo}</td>
                    <td className="py-2.5 px-3 font-bold text-[#111111]">{rec.title}</td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-[#111111]">
                      {rec.classNo}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#92400e]">{rec.decision}</td>
                    <td className="py-2.5 px-3 tabular-nums font-semibold text-[#374151]">
                      {rec.pdfReady ? 'PDF Ready' : 'Doc Only'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenGeneratedDoc(rec.docId)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[#cbd0da] bg-[#f8f9fb] hover:border-[#111111] hover:bg-[#ffee00] text-xs font-bold text-[#111111] transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#111111]" aria-hidden="true" />
                        <span>Open 909 Doc</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
