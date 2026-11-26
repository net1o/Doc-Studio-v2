import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { WorkspaceMember, WorkspaceRole } from '../types/studio';
import { memberInviteSchema } from '../lib/validation/schemas';

interface MembersViewProps {
  workspaceName: string;
  members: WorkspaceMember[];
  currentRole: WorkspaceRole;
  onUpdateRole: (userId: string, role: WorkspaceRole) => void;
  onInviteMember: (displayName: string, email: string, role: 'admin' | 'editor' | 'viewer') => void;
}

export function MembersView({
  workspaceName,
  members,
  currentRole,
  onUpdateRole,
  onInviteMember,
}: MembersViewProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = currentRole === 'owner' || currentRole === 'admin';

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = memberInviteSchema.safeParse({ displayName, email, role });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Invalid member details.');
      return;
    }
    setFormError(null);
    onInviteMember(parsed.data.displayName, parsed.data.email, parsed.data.role);
    setDisplayName('');
    setEmail('');
    setRole('editor');
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-editorial text-2xl font-bold text-[#1f1b2e]">
          Members &amp; Roles
        </h1>
        <p className="text-sm text-[#655f78] mt-0.5">
          Workspace-scoped access control for {workspaceName}. Role updates are recorded in the audit log.
        </p>
      </div>

      {canManage && (
        <form
          onSubmit={handleInvite}
          className="studio-card p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label htmlFor="invite-name" className="block text-xs font-medium text-[#4c465e] mb-1">
              Display Name
            </label>
            <input
              id="invite-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Samira Patel"
              className="w-full bg-[#fbfafc] border border-[#ddd8ea] rounded-[8px] px-3 py-2 text-xs text-[#1f1b2e]"
            />
          </div>
          <div>
            <label htmlFor="invite-email" className="block text-xs font-medium text-[#4c465e] mb-1">
              Email Address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="samira@studio-ops.local"
              className="w-full bg-[#fbfafc] border border-[#ddd8ea] rounded-[8px] px-3 py-2 text-xs text-[#1f1b2e]"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-xs font-medium text-[#4c465e] mb-1">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'editor' | 'viewer')}
              className="w-full bg-[#fbfafc] border border-[#ddd8ea] rounded-[8px] px-3 py-2 text-xs text-[#1f1b2e]"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[8px] text-xs font-semibold text-white bg-[#7463e8] hover:bg-[#6251d6] whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Member</span>
          </button>
          {formError && (
            <p className="md:col-span-4 text-xs text-[#b42318]">{formError}</p>
          )}
        </form>
      )}

      <div className="studio-card overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#e6e3ee] bg-[#fbfafc] text-[12px] text-[#655f78]">
              <th className="py-3 px-4 font-semibold">Member</th>
              <th className="py-3 px-4 font-semibold">Email</th>
              <th className="py-3 px-4 font-semibold">Joined</th>
              <th className="py-3 px-4 font-semibold text-right">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#efecf6] text-[13px]">
            {members.map((member) => (
              <tr key={member.userId} className="hover:bg-[#fbfafc]">
                <td className="py-3 px-4 font-medium text-[#1f1b2e]">
                  {member.displayName}
                </td>
                <td className="py-3 px-4 text-[#565068]">{member.email}</td>
                <td className="py-3 px-4 text-[#655f78] tabular-nums">
                  {new Date(member.joinedAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-4 text-right">
                  {canManage && member.role !== 'owner' ? (
                    <select
                      aria-label={`Role for ${member.displayName}`}
                      value={member.role}
                      onChange={(e) =>
                        onUpdateRole(member.userId, e.target.value as WorkspaceRole)
                      }
                      className="bg-white border border-[#ddd8ea] rounded-[7px] px-2.5 py-1 text-xs text-[#1f1b2e]"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className="text-xs font-medium text-[#4c465e] capitalize">
                      {member.role}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
