import { useState } from 'react';
import { Search } from 'lucide-react';
import { AuditEvent } from '../types/studio';

interface AuditLogViewProps {
  events: AuditEvent[];
  workspaceName: string;
}

export function AuditLogView({ events, workspaceName }: AuditLogViewProps) {
  const [filterText, setFilterText] = useState('');

  const filtered = events.filter((ev) => {
    const q = filterText.trim().toLowerCase();
    if (!q) return true;
    return (
      ev.action.toLowerCase().includes(q) ||
      ev.actorName.toLowerCase().includes(q) ||
      ev.entityLabel.toLowerCase().includes(q) ||
      ev.requestId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-editorial text-2xl font-bold text-[#1f1b2e]">
            Audit Log
          </h1>
          <p className="text-sm text-[#655f78] mt-0.5">
            Security and document lifecycle trail for {workspaceName}. Body contents and secrets are never logged.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            className="w-4 h-4 text-[#7c7591] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter by action, actor, or ID…"
            aria-label="Filter audit events"
            className="w-full bg-white border border-[#ddd8ea] rounded-[8px] pl-9 pr-3 py-2 text-xs text-[#1f1b2e]"
          />
        </div>
      </div>

      <div className="studio-card overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#655f78]">
            No audit events match your filter.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e6e3ee] bg-[#fbfafc] text-[12px] text-[#655f78]">
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Actor</th>
                <th className="py-3 px-4 font-semibold">Action</th>
                <th className="py-3 px-4 font-semibold">Entity</th>
                <th className="py-3 px-4 font-semibold text-right">Request ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efecf6] text-[12.5px]">
              {filtered.map((ev) => (
                <tr key={ev.id} className="hover:bg-[#fbfafc]">
                  <td className="py-3 px-4 text-[#655f78] tabular-nums whitespace-nowrap">
                    {new Date(ev.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-medium text-[#1f1b2e] whitespace-nowrap">
                    {ev.actorName}
                  </td>
                  <td className="py-3 px-4 font-mono text-[12px] text-[#5542d4] whitespace-nowrap">
                    {ev.action}
                  </td>
                  <td className="py-3 px-4 text-[#4c465e]">
                    {ev.entityLabel}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11.5px] text-[#756e8a] text-right whitespace-nowrap">
                    {ev.requestId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
