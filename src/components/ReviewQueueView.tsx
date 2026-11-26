import { useState } from 'react';
import { CheckSquare, FilePlus2, FileText } from 'lucide-react';
import { ReviewDecision, ReviewRow, ReviewStatus } from '../types/journal';

interface ReviewQueueViewProps {
  rows: ReviewRow[];
  onUpdateRow: (id: string, patch: Partial<ReviewRow>) => void;
  onMarkIssuesMailmerge: () => void;
  onGenerateDocsFromMailmerge: () => void;
  onOpenDocInGenerator: (row: ReviewRow) => void;
}

export function ReviewQueueView({
  rows,
  onUpdateRow,
  onMarkIssuesMailmerge,
  onGenerateDocsFromMailmerge,
  onOpenDocInGenerator,
}: ReviewQueueViewProps) {
  const [search, setSearch] = useState('');
  const [matchFilter, setMatchFilter] = useState<'ALL' | 'TM' | 'KEYWORD'>('ALL');
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | ReviewDecision>('ALL');

  const mailmergeReadyCount = rows.filter(
    (r) => r.status === 'MAILMERGE' && !r.generatedDocId
  ).length;

  const filtered = rows.filter((r) => {
    if (matchFilter !== 'ALL' && r.matchType !== matchFilter) return false;
    if (decisionFilter !== 'ALL' && r.decision !== decisionFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.applicationNo.toLowerCase().includes(q) ||
      r.caseNo.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.matchedTerm.toLowerCase().includes(q) ||
      r.applicant.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="bg-[#0c0c0e] border border-[#2a2a30] p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Review Queue</h2>
          <p className="text-xs text-[#9c9ca6] mt-1">
            Triage matched trademarks, set Decision &amp; Status (<span className="text-[#ffee00]">MAILMERGE</span>), and generate Legal 8.5×14 Journal 909 documents.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onMarkIssuesMailmerge}
            className="h-[38px] px-3.5 border border-[#3a3a42] bg-[#16161a] text-xs font-semibold text-white hover:border-[#ffee00] hover:text-[#ffee00] inline-flex items-center gap-1.5"
          >
            <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Mark Issue Rows MAILMERGE</span>
          </button>

          <button
            type="button"
            onClick={onGenerateDocsFromMailmerge}
            disabled={mailmergeReadyCount === 0}
            className="builty-btn h-[38px] pl-4 pr-2 gap-2 text-xs"
          >
            <span>Generate Docs ({mailmergeReadyCount})</span>
            <span className="builty-btn-icon-tab w-6 h-6">
              <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search App No, Case No, Title, or Matched Term…"
            aria-label="Search Review rows"
            className="w-full max-w-sm bg-[#0c0c0e] border border-[#2a2a30] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffee00]"
          />

          <div className="flex items-center border border-[#2a2a30] bg-[#0c0c0e]">
            {(['ALL', 'TM', 'KEYWORD'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMatchFilter(t)}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  matchFilter === t
                    ? 'bg-[#ffee00] text-black'
                    : 'text-[#c7c7d1] hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by decision"
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value as 'ALL' | ReviewDecision)}
            className="bg-[#0c0c0e] border border-[#2a2a30] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffee00]"
          >
            <option value="ALL">All Decisions</option>
            <option value="PENDING REVIEW">PENDING REVIEW</option>
            <option value="ISSUE - OPPOSE">ISSUE - OPPOSE</option>
            <option value="NO ISSUE - CLEAR">NO ISSUE - CLEAR</option>
          </select>
        </div>

        <span className="text-xs text-[#9c9ca6] tabular-nums">
          {filtered.length} of {rows.length} matches
        </span>
      </div>

      {/* Review Table */}
      <div className="bg-[#0c0c0e] border border-[#2a2a30] overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1120px]">
          <thead>
            <tr className="bg-[#ffee00] text-black text-[11.5px] font-extrabold uppercase tracking-wider">
              <th className="py-2.5 px-3">Jrn</th>
              <th className="py-2.5 px-3">App No</th>
              <th className="py-2.5 px-3">Case No</th>
              <th className="py-2.5 px-3">Title</th>
              <th className="py-2.5 px-3 text-center">Class</th>
              <th className="py-2.5 px-3">Matched</th>
              <th className="py-2.5 px-3 text-center">Page</th>
              <th className="py-2.5 px-3">Decision</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">909 Doc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f1f24] text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-[#9c9ca6]">
                  No Review rows found. Load JournalCheck data and click Run Scan.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="hover:bg-[#141418]">
                  <td className="py-2.5 px-3 font-mono text-[#c7c7d1] tabular-nums">
                    {row.journalNo}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-white tabular-nums">
                    {row.applicationNo}
                  </td>
                  <td className="py-2.5 px-3 text-[#d0d0d8] max-w-[180px] truncate" title={row.caseNo}>
                    {row.caseNo}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-white">{row.title}</div>
                    <div className="text-[11px] text-[#8f8f99] truncate max-w-[230px]" title={row.applicant}>
                      {row.applicant}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-white tabular-nums">
                    {row.classNo}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-mono text-[#ffee00]">{row.matchedTerm}</div>
                    <div className="text-[11px] text-[#9c9ca6]">{row.matchType}</div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-[#c7c7d1] tabular-nums">
                    {row.pageNo || '—'}
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      aria-label={`Decision for ${row.applicationNo}`}
                      value={row.decision}
                      onChange={(e) =>
                        onUpdateRow(row.id, { decision: e.target.value as ReviewDecision })
                      }
                      className="bg-[#16161a] border border-[#2f2f36] px-2 py-1.5 text-[11.5px] text-white focus:border-[#ffee00]"
                    >
                      <option value="PENDING REVIEW">PENDING REVIEW</option>
                      <option value="ISSUE - OPPOSE">ISSUE - OPPOSE</option>
                      <option value="NO ISSUE - CLEAR">NO ISSUE - CLEAR</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      aria-label={`Status for ${row.applicationNo}`}
                      value={row.status}
                      onChange={(e) =>
                        onUpdateRow(row.id, { status: e.target.value as ReviewStatus })
                      }
                      className={`border px-2 py-1.5 text-[11.5px] font-semibold focus:border-[#ffee00] ${
                        row.status === 'GENERATED'
                          ? 'bg-[#17281b] border-[#2f6f3e] text-[#86efac]'
                          : row.status === 'MAILMERGE'
                          ? 'bg-[#292507] border-[#ffee00] text-[#ffee00]'
                          : 'bg-[#16161a] border-[#2f2f36] text-white'
                      }`}
                    >
                      <option value="REVIEW">REVIEW</option>
                      <option value="MAILMERGE">MAILMERGE</option>
                      <option value="GENERATED">GENERATED</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onOpenDocInGenerator(row)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[#3a3a42] bg-[#16161a] hover:border-[#ffee00] hover:text-[#ffee00] text-[11.5px] font-semibold text-white"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#ffee00]" aria-hidden="true" />
                      <span>
                        {row.generatedDocId
                          ? row.generatedPdfReady
                            ? 'Open (PDF Ready)'
                            : 'Open Doc'
                          : 'Merge 909'}
                      </span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
