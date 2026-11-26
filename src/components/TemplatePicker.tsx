import { FilePlus2, LayoutTemplate } from 'lucide-react';
import { DocumentTemplate, WorkspaceRole } from '../types/studio';

interface TemplatePickerProps {
  templates: DocumentTemplate[];
  onUseTemplate: (template: DocumentTemplate) => void;
  onOpenAllTemplates?: () => void;
  compact?: boolean;
  currentRole: WorkspaceRole;
}

export function TemplatePicker({
  templates,
  onUseTemplate,
  onOpenAllTemplates,
  compact = true,
  currentRole,
}: TemplatePickerProps) {
  const canEdit = currentRole !== 'viewer';

  if (compact) {
    return (
      <section
        aria-label="Template picker"
        className="bg-white border border-[#e6e3ee] rounded-[10px] px-4 py-3 shadow-[0_1px_3px_rgba(31,27,46,0.03)]"
      >
        <div className="flex items-center justify-between gap-4 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <LayoutTemplate className="w-4 h-4 text-[#7463e8] shrink-0" aria-hidden="true" />
            <h2 className="font-editorial text-sm font-bold text-[#1f1b2e] truncate">
              Start from a Template
            </h2>
          </div>
          {onOpenAllTemplates && (
            <button
              type="button"
              onClick={onOpenAllTemplates}
              className="text-xs font-medium text-[#7463e8] hover:underline whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#7463e8]"
            >
              View all ({templates.length})
            </button>
          )}
        </div>

        {templates.length === 0 ? (
          <p className="text-xs text-[#655f78]">
            No templates saved in this workspace yet. Save any active document as a reusable template.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {templates.slice(0, 4).map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                disabled={!canEdit}
                onClick={() => onUseTemplate(tpl)}
                className="group text-left bg-[#fbfafc] hover:bg-[#f4f1fc] border border-[#e6e3ee] hover:border-[#cfc6f5] rounded-[9px] px-3 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[#7463e8]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-editorial text-[13.5px] font-bold text-[#1f1b2e] truncate">
                    {tpl.name}
                  </span>
                  <FilePlus2
                    className="w-3.5 h-3.5 text-[#7463e8] opacity-75 group-hover:opacity-100 shrink-0"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1 text-[11.5px] text-[#655f78] line-clamp-1">
                  {tpl.category} · {tpl.description}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="font-editorial text-2xl font-bold text-[#1f1b2e]">
            Document Templates
          </h1>
          <p className="text-sm text-[#655f78] mt-0.5">
            Reusable workspace structures with pre-configured headings, tables, headers, and footers.
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="studio-card p-8 text-center">
          <p className="font-editorial text-base font-bold text-[#1f1b2e]">
            No templates in this workspace
          </p>
          <p className="text-sm text-[#655f78] mt-1">
            Open any document in the editor and choose “Save as Template” to build your reusable library.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <article
              key={tpl.id}
              className="studio-card p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="text-xs text-[#655f78] mb-1.5">
                  <span>{tpl.category}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{tpl.isShared ? 'Workspace shared' : 'Private'}</span>
                </div>
                <h2 className="font-editorial text-lg font-bold text-[#1f1b2e]">
                  {tpl.name}
                </h2>
                <p className="text-sm text-[#565068] mt-1.5 leading-relaxed">
                  {tpl.description}
                </p>
              </div>
              <div className="pt-3 border-t border-[#efecf6] flex items-center justify-between">
                <span className="text-xs text-[#756e8a] tabular-nums">
                  Created {new Date(tpl.createdAt).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onUseTemplate(tpl)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-xs font-semibold text-white bg-[#7463e8] hover:bg-[#6251d6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Use Template</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
