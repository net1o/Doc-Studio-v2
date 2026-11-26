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
          <h2 className="text-xl font-bold text-white">
            Trademark Journal Monitoring Report
          </h2>
          <p className="text-xs text-[#9c9ca6] mt-1">
            Current Journal (No. {currentJournalNo}) vs. All-Time summary, Decision breakdown, and Match Type distribution.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#0c0c0e] border border-[#2a2a30] p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#ffee00] uppercase tracking-wider">
              Current Journal (No. {currentJournalNo}) vs All-Time
            </h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#2a2a30] text-[#9c9ca6]">
                  <th className="py-2 text-left">Metric</th>
                  <th className="py-2 text-right">Journal {currentJournalNo}</th>
                  <th className="py-2 text-right">All-Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f24] tabular-nums">
                <tr>
                  <td className="py-2 text-[#d0d0d8]">Total Matches</td>
                  <td className="py-2 text-right font-bold text-white">{currentStats.total}</td>
                  <td className="py-2 text-right text-[#d0d0d8]">{allTimeStats.total}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[#d0d0d8]">TM Matches</td>
                  <td className="py-2 text-right font-bold text-white">{currentStats.tmMatches}</td>
                  <td className="py-2 text-right text-[#d0d0d8]">{allTimeStats.tmMatches}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[#d0d0d8]">Keyword Matches</td>
                  <td className="py-2 text-right font-bold text-white">{currentStats.keywordMatches}</td>
                  <td className="py-2 text-right text-[#d0d0d8]">{allTimeStats.keywordMatches}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[#d0d0d8]">Issue / Oppose</td>
                  <td className="py-2 text-right font-bold text-[#ffee00]">{currentStats.issue}</td>
                  <td className="py-2 text-right text-[#ffee00]">{allTimeStats.issue}</td>
                </tr>
                <tr>
                  <td className="py-2 text-[#d0d0d8]">Docs / PDFs Generated</td>
                  <td className="py-2 text-right font-bold text-white">
                    {currentStats.docsGenerated} / {currentStats.pdfsGenerated}
                  </td>
                  <td className="py-2 text-right text-[#d0d0d8]">
                    {allTimeStats.docsGenerated} / {allTimeStats.pdfsGenerated}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Visual Proportion Breakdowns */}
          <div className="bg-[#0c0c0e] border border-[#2a2a30] p-5 space-y-5">
            <h3 className="text-sm font-bold text-[#ffee00] uppercase tracking-wider">
              Decision &amp; Match Type Breakdown
            </h3>

            <div className="space-y-3">
              {[
                { label: 'Pending Review', val: allTimeStats.pending, color: 'bg-[#a6a6b0]' },
                { label: 'Issue / Oppose', val: allTimeStats.issue, color: 'bg-[#ffee00]' },
                { label: 'No Issue / Clear', val: allTimeStats.clear, color: 'bg-[#4ade80]' },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs tabular-nums">
                    <span className="text-[#d0d0d8]">{item.label}</span>
                    <span className="font-bold text-white">
                      {item.val} ({Math.round((item.val / decisionTotal) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[#1c1c22]">
                    <div
                      className={`h-full ${item.color}`}
                      style={{ width: `${Math.round((item.val / decisionTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#1f1f24] space-y-3">
              {[
                { label: 'TM Number Matches', val: allTimeStats.tmMatches, color: 'bg-[#ffee00]' },
                { label: 'Keyword Matches', val: allTimeStats.keywordMatches, color: 'bg-white' },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs tabular-nums">
                    <span className="text-[#d0d0d8]">{item.label}</span>
                    <span className="font-bold text-white">
                      {item.val} ({Math.round((item.val / matchTotal) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[#1c1c22]">
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
            <h2 className="text-xl font-bold text-white">Records Ledger</h2>
            <p className="text-xs text-[#9c9ca6]">
              Archive of generated Journal 909 documents and PDF readiness.
            </p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter records by App No, Case No, or Title…"
            className="w-full sm:w-80 bg-[#0c0c0e] border border-[#2a2a30] px-3 py-2 text-xs text-white focus:border-[#ffee00]"
          />
        </div>

        <div className="bg-[#0c0c0e] border border-[#2a2a30] overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-[#ffee00] text-black text-[11.5px] font-extrabold uppercase tracking-wider">
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
            <tbody className="divide-y divide-[#1f1f24] text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#9c9ca6]">
                    No generated records yet. Mark Review rows as MAILMERGE and click Generate Docs.
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#141418]">
                    <td className="py-2.5 px-3 font-mono tabular-nums text-[#d0d0d8]">
                      {rec.journalNo} ({rec.journalDate})
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-white tabular-nums">
                      {rec.applicationNo}
                    </td>
                    <td className="py-2.5 px-3 text-[#d0d0d8]">{rec.caseNo}</td>
                    <td className="py-2.5 px-3 font-semibold text-white">{rec.title}</td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-white">
                      {rec.classNo}
                    </td>
                    <td className="py-2.5 px-3 text-[#ffee00]">{rec.decision}</td>
                    <td className="py-2.5 px-3 tabular-nums">
                      {rec.pdfReady ? 'PDF Ready' : 'Doc Only'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenGeneratedDoc(rec.docId)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[#3a3a42] bg-[#16161a] hover:border-[#ffee00] hover:text-[#ffee00] text-xs font-semibold text-white"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#ffee00]" aria-hidden="true" />
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
