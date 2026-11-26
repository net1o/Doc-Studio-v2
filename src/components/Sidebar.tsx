import { useState } from 'react';
import {
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  LayoutTemplate,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Folder, StudioView, Workspace, WorkspaceRole } from '../types/studio';

interface SidebarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (workspaceId: string) => void;
  activeView: StudioView;
  onSelectView: (view: StudioView) => void;
  folders: Folder[];
  activeFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string) => void;
  onCreateBlankDocument: () => void;
  activeDocCount: number;
  trashCount: number;
  templateCount: number;
  folderCounts: Record<string, number>;
  currentRole: WorkspaceRole;
  onChangeRolePreview: (role: WorkspaceRole) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  activeView,
  onSelectView,
  folders,
  activeFolderId,
  onSelectFolder,
  onCreateFolder,
  onCreateBlankDocument,
  activeDocCount,
  trashCount,
  templateCount,
  folderCounts,
  currentRole,
  onChangeRolePreview,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const canEdit = currentRole !== 'viewer';

  const handleFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    onCreateFolder(trimmed);
    setNewFolderName('');
    setCreatingFolder(false);
  };

  const navItems: { id: StudioView; label: string; count?: number; icon: typeof FileText }[] = [
    { id: 'documents', label: 'Documents', count: activeDocCount, icon: FileText },
    { id: 'templates', label: 'Templates', count: templateCount, icon: LayoutTemplate },
    { id: 'trash', label: 'Trash', count: trashCount, icon: Trash2 },
    { id: 'members', label: 'Members & Roles', icon: Users },
    { id: 'audit', label: 'Audit Log', icon: ShieldCheck },
  ];

  const sidebarContent = (
    <aside
      aria-label="Workspace navigation"
      className="h-full flex flex-col bg-[#f6f5f8] border-r border-[#e6e3ee] w-[264px] shrink-0 select-none"
    >
      <div className="px-4 pt-4 pb-3 border-b border-[#e6e3ee] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-editorial text-[17px] font-bold tracking-tight text-[#1f1b2e] block truncate">
            Document Studio
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 rounded-[8px] text-[#655f78] hover:bg-[#ebe8f2] focus-visible:outline-2 focus-visible:outline-[#7463e8]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-3 border-b border-[#e6e3ee]">
        <div>
          <label
            htmlFor="workspace-select"
            className="block text-[11px] font-medium text-[#655f78] mb-1"
          >
            Workspace
          </label>
          <select
            id="workspace-select"
            value={activeWorkspaceId}
            onChange={(e) => onSelectWorkspace(e.target.value)}
            className="w-full bg-white border border-[#ddd8ea] rounded-[8px] px-2.5 py-2 text-[13px] font-medium text-[#1f1b2e] focus-visible:outline-2 focus-visible:outline-[#7463e8]"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            onCreateBlankDocument();
            onCloseMobile();
          }}
          disabled={!canEdit}
          className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-[9px] text-[13px] font-semibold text-white bg-[#7463e8] hover:bg-[#6251d6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7463e8]"
        >
          <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>New Document</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        <div>
          <p className="px-2 mb-1.5 text-[11px] font-medium text-[#756e8a]">
            Studio
          </p>
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id && (item.id !== 'documents' || activeFolderId === null);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectView(item.id);
                      if (item.id === 'documents') {
                        onSelectFolder(null);
                      }
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[8px] text-[13px] transition-colors text-left focus-visible:outline-2 focus-visible:outline-[#7463e8] ${
                      isActive
                        ? 'bg-white text-[#1f1b2e] font-semibold shadow-[0_1px_2px_rgba(31,27,46,0.05)] border border-[#e6e3ee]'
                        : 'text-[#4c465e] hover:bg-[#ece9f4] hover:text-[#1f1b2e] border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#7463e8]' : 'text-[#756e8a]'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && (
                      <span className="text-[12px] text-[#756e8a] tabular-nums shrink-0">
                        {item.count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#756e8a]">Folders</span>
            {canEdit && (
              <button
                type="button"
                onClick={() => setCreatingFolder((prev) => !prev)}
                aria-label="Create folder"
                title="Create folder"
                className="p-1 rounded-[6px] text-[#655f78] hover:bg-[#e8e4f2] hover:text-[#1f1b2e] focus-visible:outline-2 focus-visible:outline-[#7463e8]"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {creatingFolder && (
            <form onSubmit={handleFolderSubmit} className="px-1 mb-2 flex gap-1.5">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                aria-label="New folder name"
                className="flex-1 min-w-0 bg-white border border-[#d6d0e4] rounded-[8px] px-2 py-1 text-[12px] text-[#1f1b2e] focus-visible:outline-2 focus-visible:outline-[#7463e8]"
                autoFocus
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded-[8px] bg-[#7463e8] text-white text-[12px] font-medium hover:bg-[#6251d6]"
              >
                Add
              </button>
            </form>
          )}

          {folders.length === 0 ? (
            <p className="px-2.5 py-1.5 text-[12px] text-[#7c7591]">
              No folders in this workspace.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {folders.map((folder) => {
                const isSelected = activeView === 'documents' && activeFolderId === folder.id;
                const count = folderCounts[folder.id] || 0;
                return (
                  <li key={folder.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectView('documents');
                        onSelectFolder(folder.id);
                        onCloseMobile();
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[8px] text-[13px] transition-colors text-left focus-visible:outline-2 focus-visible:outline-[#7463e8] ${
                        isSelected
                          ? 'bg-white text-[#1f1b2e] font-semibold shadow-[0_1px_2px_rgba(31,27,46,0.05)] border border-[#e6e3ee]'
                          : 'text-[#4c465e] hover:bg-[#ece9f4] hover:text-[#1f1b2e] border border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <FolderIcon
                          className={`w-4 h-4 shrink-0 ${
                            isSelected ? 'text-[#7463e8]' : 'text-[#756e8a]'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate">{folder.name}</span>
                      </span>
                      <span className="text-[12px] text-[#756e8a] tabular-nums shrink-0">
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </nav>

      <div className="p-3.5 border-t border-[#e6e3ee] bg-[#f2f0f6]">
        <label
          htmlFor="role-preview-select"
          className="block text-[11px] font-medium text-[#655f78] mb-1"
        >
          Access Role Preview
        </label>
        <select
          id="role-preview-select"
          value={currentRole}
          onChange={(e) => onChangeRolePreview(e.target.value as WorkspaceRole)}
          className="w-full bg-white border border-[#ddd8ea] rounded-[8px] px-2.5 py-1.5 text-[12.5px] text-[#1f1b2e] focus-visible:outline-2 focus-visible:outline-[#7463e8]"
        >
          <option value="owner">Owner (Full access)</option>
          <option value="admin">Admin (Manage & edit)</option>
          <option value="editor">Editor (Create & edit)</option>
          <option value="viewer">Viewer (Read-only)</option>
        </select>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block h-full shrink-0">{sidebarContent}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#1f1b2e]/30"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
