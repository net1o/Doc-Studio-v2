import {
  AuditEvent,
  DocumentAsset,
  DocumentContentPayload,
  DocumentRecord,
  DocumentTemplate,
  DocumentVersion,
  ExportJob,
  Folder,
  Profile,
  Workspace,
  WorkspaceMember,
} from '../../types/studio';
import { countWords, extractPlainText, generateRequestId, sanitizeDocumentHtml } from '../security/sanitize';

const STORAGE_KEY = 'document_studio_state_v1';

export interface StudioState {
  currentUser: Profile;
  activeWorkspaceId: string;
  workspaces: Workspace[];
  members: WorkspaceMember[];
  folders: Folder[];
  documents: DocumentRecord[];
  versions: DocumentVersion[];
  templates: DocumentTemplate[];
  assets: DocumentAsset[];
  exports: ExportJob[];
  auditEvents: AuditEvent[];
}

const NOW = '2026-11-26T09:40:00.000Z';

function makeSeedState(): StudioState {
  const user: Profile = {
    id: 'usr_aria_chen',
    displayName: 'Aria Chen',
    email: 'aria.chen@studio-ops.local',
    title: 'Editorial Operations Lead',
  };

  const workspaces: Workspace[] = [
    {
      id: 'ws_operations',
      name: 'Operations Studio',
      slug: 'operations-studio',
      createdBy: user.id,
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: NOW,
    },
    {
      id: 'ws_advisory',
      name: 'Client Advisory',
      slug: 'client-advisory',
      createdBy: user.id,
      createdAt: '2026-11-05T10:30:00.000Z',
      updatedAt: NOW,
    },
  ];

  const members: WorkspaceMember[] = [
    {
      workspaceId: 'ws_operations',
      userId: user.id,
      displayName: 'Aria Chen',
      email: 'aria.chen@studio-ops.local',
      role: 'owner',
      joinedAt: '2026-11-01T08:00:00.000Z',
    },
    {
      workspaceId: 'ws_operations',
      userId: 'usr_marcus_reed',
      displayName: 'Marcus Reed',
      email: 'marcus.reed@studio-ops.local',
      role: 'admin',
      joinedAt: '2026-11-03T11:15:00.000Z',
    },
    {
      workspaceId: 'ws_operations',
      userId: 'usr_nadia_farooq',
      displayName: 'Nadia Farooq',
      email: 'nadia.farooq@studio-ops.local',
      role: 'editor',
      joinedAt: '2026-11-07T14:20:00.000Z',
    },
    {
      workspaceId: 'ws_operations',
      userId: 'usr_jonah_lin',
      displayName: 'Jonah Lin',
      email: 'jonah.lin@studio-ops.local',
      role: 'viewer',
      joinedAt: '2026-11-12T09:05:00.000Z',
    },
    {
      workspaceId: 'ws_advisory',
      userId: user.id,
      displayName: 'Aria Chen',
      email: 'aria.chen@studio-ops.local',
      role: 'owner',
      joinedAt: '2026-11-05T10:30:00.000Z',
    },
    {
      workspaceId: 'ws_advisory',
      userId: 'usr_nadia_farooq',
      displayName: 'Nadia Farooq',
      email: 'nadia.farooq@studio-ops.local',
      role: 'editor',
      joinedAt: '2026-11-08T16:40:00.000Z',
    },
  ];

  const folders: Folder[] = [
    {
      id: 'fld_governance',
      workspaceId: 'ws_operations',
      parentId: null,
      name: 'Policies & SOPs',
      createdAt: '2026-11-01T08:15:00.000Z',
    },
    {
      id: 'fld_quarterly',
      workspaceId: 'ws_operations',
      parentId: null,
      name: 'Quarterly Briefs',
      createdAt: '2026-11-02T09:00:00.000Z',
    },
    {
      id: 'fld_meetings',
      workspaceId: 'ws_operations',
      parentId: null,
      name: 'Meeting Notes',
      createdAt: '2026-11-04T12:00:00.000Z',
    },
    {
      id: 'fld_proposals',
      workspaceId: 'ws_advisory',
      parentId: null,
      name: 'Client Proposals',
      createdAt: '2026-11-05T11:00:00.000Z',
    },
  ];

  const doc1ContentV1: DocumentContentPayload = {
    headerText: 'Operations Studio · Internal Governance Brief',
    footerText: 'Confidential — Approved for workspace review only',
    direction: 'ltr',
    html: sanitizeDocumentHtml(`
      <h2>1. Executive Summary</h2>
      <p>This brief establishes the Q4 editorial workflow for business documents created, reviewed, and exported within Document Studio. Every document passes through structured authoring, explicit version checkpoints, and verified export generation.</p>
      <h2>2. Release &amp; Quality Gates</h2>
      <table>
        <thead>
          <tr><th>Gate</th><th>Owner</th><th>Verification</th></tr>
        </thead>
        <tbody>
          <tr><td>Schema &amp; RLS Baseline</td><td>Platform Engineering</td><td>Isolated migration verified</td></tr>
          <tr><td>Editor Autosave &amp; History</td><td>Frontend Studio</td><td>Immutable checkpoints active</td></tr>
          <tr><td>Preview Deployment QA</td><td>Release Lead</td><td>In progress on Vercel preview</td></tr>
        </tbody>
      </table>
      <h2>3. Required Controls</h2>
      <ul>
        <li>Sanitize all imported HTML and Markdown payloads prior to rendering.</li>
        <li>Bind every PDF and DOCX export artifact to an exact immutable version ID.</li>
        <li>Preserve 30-day soft-delete recovery before permanent disposal.</li>
      </ul>
    `),
  };

  const doc1ContentV2: DocumentContentPayload = {
    ...doc1ContentV1,
    html: sanitizeDocumentHtml(
      doc1ContentV1.html +
        `<h2>4. Regional &amp; RTL Readiness</h2><p>Documents support both left-to-right English and right-to-left Urdu script layouts without altering underlying version snapshots.</p>`
    ),
  };

  const doc2Content: DocumentContentPayload = {
    headerText: 'Standard Operating Procedure · SOP-014',
    footerText: 'Operations Studio · Revision 2',
    direction: 'ltr',
    html: sanitizeDocumentHtml(`
      <h2>Purpose</h2>
      <p>Define a repeatable process for onboarding external service vendors, verifying security questionnaires, and archiving signed statements of work.</p>
      <h2>Checklist</h2>
      <ol>
        <li>Collect vendor corporate registration and primary security contact.</li>
        <li>Verify data-processing addendum and retention schedule.</li>
        <li>Attach executed agreements as private workspace assets with SHA-256 verification.</li>
      </ol>
      <hr class="page-break" />
      <h2>Approval Sign-off</h2>
      <p>All SOP updates require admin review and an explicit version checkpoint before export distribution.</p>
    `),
  };

  const doc3Content: DocumentContentPayload = {
    headerText: 'Weekly Editorial Sync · Operations',
    footerText: 'Internal Notes',
    direction: 'ltr',
    html: sanitizeDocumentHtml(`
      <h2>Agenda &amp; Decisions</h2>
      <ul>
        <li>Confirmed warm paper canvas and restrained violet accent tokens across editor surfaces.</li>
        <li>Validated keyboard shortcuts for bold, italic, headings, and manual version checkpoints.</li>
        <li>Scheduled authenticated preview QA before advancing Production milestone.</li>
      </ul>
    `),
  };

  const doc4Content: DocumentContentPayload = {
    headerText: 'Client Advisory · Engagement Scope',
    footerText: 'Prepared for Northwind Logistics',
    direction: 'ltr',
    html: sanitizeDocumentHtml(`
      <h2>Engagement Overview</h2>
      <p>Comprehensive documentation modernization across regional fulfillment centers, covering standard operating manuals, safety checklists, and quarterly executive summaries.</p>
      <table>
        <thead>
          <tr><th>Deliverable</th><th>Target Window</th><th>Format</th></tr>
        </thead>
        <tbody>
          <tr><td>Fulfillment Playbook</td><td>Week 2</td><td>PDF &amp; DOCX</td></tr>
          <tr><td>Safety Audit Packet</td><td>Week 4</td><td>PDF</td></tr>
        </tbody>
      </table>
    `),
  };

  const docTrashedContent: DocumentContentPayload = {
    headerText: 'Draft Archive',
    footerText: 'Superseded draft',
    direction: 'ltr',
    html: sanitizeDocumentHtml(
      '<p>Early outline superseded by the Q4 Operational Readiness Brief. Retained in Trash for 30-day recovery testing.</p>'
    ),
  };

  const versions: DocumentVersion[] = [
    {
      id: 'ver_doc1_1',
      documentId: 'doc_readiness_brief',
      versionNo: 1,
      content: doc1ContentV1,
      plainText: extractPlainText(doc1ContentV1.html),
      wordCount: countWords(extractPlainText(doc1ContentV1.html)),
      createdBy: user.id,
      createdByName: user.displayName,
      source: 'manual',
      summary: 'Initial baseline structure and release gates table',
      createdAt: '2026-11-24T14:10:00.000Z',
    },
    {
      id: 'ver_doc1_2',
      documentId: 'doc_readiness_brief',
      versionNo: 2,
      content: doc1ContentV2,
      plainText: extractPlainText(doc1ContentV2.html),
      wordCount: countWords(extractPlainText(doc1ContentV2.html)),
      createdBy: 'usr_nadia_farooq',
      createdByName: 'Nadia Farooq',
      source: 'manual',
      summary: 'Added RTL script readiness section',
      createdAt: '2026-11-26T09:15:00.000Z',
    },
    {
      id: 'ver_doc2_1',
      documentId: 'doc_vendor_sop',
      versionNo: 1,
      content: doc2Content,
      plainText: extractPlainText(doc2Content.html),
      wordCount: countWords(extractPlainText(doc2Content.html)),
      createdBy: 'usr_marcus_reed',
      createdByName: 'Marcus Reed',
      source: 'manual',
      summary: 'Published vendor onboarding SOP draft',
      createdAt: '2026-11-25T16:30:00.000Z',
    },
    {
      id: 'ver_doc3_1',
      documentId: 'doc_weekly_sync',
      versionNo: 1,
      content: doc3Content,
      plainText: extractPlainText(doc3Content.html),
      wordCount: countWords(extractPlainText(doc3Content.html)),
      createdBy: user.id,
      createdByName: user.displayName,
      source: 'manual',
      summary: 'Captured weekly sync decisions',
      createdAt: '2026-11-26T08:30:00.000Z',
    },
    {
      id: 'ver_doc4_1',
      documentId: 'doc_client_scope',
      versionNo: 1,
      content: doc4Content,
      plainText: extractPlainText(doc4Content.html),
      wordCount: countWords(extractPlainText(doc4Content.html)),
      createdBy: user.id,
      createdByName: user.displayName,
      source: 'manual',
      summary: 'Initial client scope table',
      createdAt: '2026-11-25T11:20:00.000Z',
    },
    {
      id: 'ver_doc5_1',
      documentId: 'doc_old_outline',
      versionNo: 1,
      content: docTrashedContent,
      plainText: extractPlainText(docTrashedContent.html),
      wordCount: countWords(extractPlainText(docTrashedContent.html)),
      createdBy: user.id,
      createdByName: user.displayName,
      source: 'manual',
      summary: 'Superseded outline',
      createdAt: '2026-11-18T10:00:00.000Z',
    },
  ];

  const documents: DocumentRecord[] = [
    {
      id: 'doc_readiness_brief',
      workspaceId: 'ws_operations',
      folderId: 'fld_quarterly',
      title: 'Q4 Operational Readiness Brief',
      tags: ['governance', 'release', 'q4'],
      status: 'active',
      currentVersionId: 'ver_doc1_2',
      draftContent: doc1ContentV2,
      plainText: extractPlainText(doc1ContentV2.html),
      wordCount: countWords(extractPlainText(doc1ContentV2.html)),
      createdBy: user.id,
      createdByName: user.displayName,
      deletedAt: null,
      createdAt: '2026-11-24T14:10:00.000Z',
      updatedAt: '2026-11-26T09:15:00.000Z',
    },
    {
      id: 'doc_vendor_sop',
      workspaceId: 'ws_operations',
      folderId: 'fld_governance',
      title: 'Vendor Onboarding Standard Procedure',
      tags: ['sop', 'compliance'],
      status: 'active',
      currentVersionId: 'ver_doc2_1',
      draftContent: doc2Content,
      plainText: extractPlainText(doc2Content.html),
      wordCount: countWords(extractPlainText(doc2Content.html)),
      createdBy: 'usr_marcus_reed',
      createdByName: 'Marcus Reed',
      deletedAt: null,
      createdAt: '2026-11-25T16:30:00.000Z',
      updatedAt: '2026-11-25T16:30:00.000Z',
    },
    {
      id: 'doc_weekly_sync',
      workspaceId: 'ws_operations',
      folderId: 'fld_meetings',
      title: 'Editorial Architecture Weekly Sync',
      tags: ['meeting', 'design'],
      status: 'active',
      currentVersionId: 'ver_doc3_1',
      draftContent: doc3Content,
      plainText: extractPlainText(doc3Content.html),
      wordCount: countWords(extractPlainText(doc3Content.html)),
      createdBy: user.id,
      createdByName: user.displayName,
      deletedAt: null,
      createdAt: '2026-11-26T08:30:00.000Z',
      updatedAt: '2026-11-26T08:30:00.000Z',
    },
    {
      id: 'doc_client_scope',
      workspaceId: 'ws_advisory',
      folderId: 'fld_proposals',
      title: 'Northwind Fulfillment Documentation Scope',
      tags: ['proposal', 'advisory'],
      status: 'active',
      currentVersionId: 'ver_doc4_1',
      draftContent: doc4Content,
      plainText: extractPlainText(doc4Content.html),
      wordCount: countWords(extractPlainText(doc4Content.html)),
      createdBy: user.id,
      createdByName: user.displayName,
      deletedAt: null,
      createdAt: '2026-11-25T11:20:00.000Z',
      updatedAt: '2026-11-25T11:20:00.000Z',
    },
    {
      id: 'doc_old_outline',
      workspaceId: 'ws_operations',
      folderId: 'fld_quarterly',
      title: 'Superseded Q4 Outline',
      tags: ['archive'],
      status: 'trashed',
      currentVersionId: 'ver_doc5_1',
      draftContent: docTrashedContent,
      plainText: extractPlainText(docTrashedContent.html),
      wordCount: countWords(extractPlainText(docTrashedContent.html)),
      createdBy: user.id,
      createdByName: user.displayName,
      deletedAt: '2026-11-25T19:00:00.000Z',
      createdAt: '2026-11-18T10:00:00.000Z',
      updatedAt: '2026-11-25T19:00:00.000Z',
    },
  ];

  const templates: DocumentTemplate[] = [
    {
      id: 'tpl_exec_brief',
      workspaceId: 'ws_operations',
      name: 'Executive Brief',
      category: 'Strategy',
      description: 'Two-page decision memo with summary, key risks table, and sign-off block.',
      createdBy: user.id,
      isShared: true,
      createdAt: '2026-11-02T09:00:00.000Z',
      content: {
        headerText: 'Executive Brief · Draft',
        footerText: 'Internal Distribution',
        direction: 'ltr',
        html: sanitizeDocumentHtml(`
          <h2>Executive Context</h2>
          <p>Summarize the business objective, decision deadline, and operational constraints in three concise sentences.</p>
          <h2>Options &amp; Trade-offs</h2>
          <table>
            <thead><tr><th>Option</th><th>Effort</th><th>Outcome</th></tr></thead>
            <tbody>
              <tr><td>Option A (Recommended)</td><td>Medium</td><td>Balanced delivery timeline</td></tr>
              <tr><td>Option B</td><td>High</td><td>Extended scope coverage</td></tr>
            </tbody>
          </table>
          <h2>Next Actions</h2>
          <ul><li>Confirm owner and review window.</li><li>Checkpoint final version prior to PDF export.</li></ul>
        `),
      },
    },
    {
      id: 'tpl_sop',
      workspaceId: 'ws_operations',
      name: 'Standard Operating Procedure',
      category: 'Operations',
      description: 'Structured playbook with scope, numbered steps, page break, and approval log.',
      createdBy: 'usr_marcus_reed',
      isShared: true,
      createdAt: '2026-11-04T10:15:00.000Z',
      content: {
        headerText: 'Standard Operating Procedure',
        footerText: 'Controlled Operational Document',
        direction: 'ltr',
        html: sanitizeDocumentHtml(`
          <h2>1. Scope &amp; Applicability</h2>
          <p>Describe which teams and systems are governed by this procedure.</p>
          <h2>2. Step-by-Step Execution</h2>
          <ol>
            <li>Verify prerequisites and workspace authorization.</li>
            <li>Execute the documented operational steps in sequence.</li>
            <li>Record completion evidence and audit reference.</li>
          </ol>
          <hr class="page-break" />
          <h2>3. Revision Control</h2>
          <p>Restoring a historical version creates a new immutable checkpoint.</p>
        `),
      },
    },
    {
      id: 'tpl_meeting',
      workspaceId: 'ws_operations',
      name: 'Meeting Minutes',
      category: 'Collaboration',
      description: 'Focused notes layout for attendees, decisions, and dated follow-ups.',
      createdBy: 'usr_nadia_farooq',
      isShared: true,
      createdAt: '2026-11-08T15:00:00.000Z',
      content: {
        headerText: 'Meeting Minutes',
        footerText: 'Workspace Collaboration Notes',
        direction: 'ltr',
        html: sanitizeDocumentHtml(`
          <h2>Attendees &amp; Objective</h2>
          <p>List participants and the primary decision goal for the session.</p>
          <h2>Key Decisions</h2>
          <ul><li>Decision 1: Record rationale and owner.</li></ul>
          <h2>Action Items</h2>
          <table>
            <thead><tr><th>Action</th><th>Owner</th><th>Target Date</th></tr></thead>
            <tbody><tr><td>Follow-up review</td><td>TBD</td><td>Next week</td></tr></tbody>
          </table>
        `),
      },
    },
    {
      id: 'tpl_proposal',
      workspaceId: 'ws_advisory',
      name: 'Client Proposal',
      category: 'Advisory',
      description: 'Clean client-ready proposal with deliverables matrix and timeline.',
      createdBy: user.id,
      isShared: true,
      createdAt: '2026-11-06T12:00:00.000Z',
      content: {
        headerText: 'Client Proposal',
        footerText: 'Prepared with Document Studio',
        direction: 'ltr',
        html: sanitizeDocumentHtml(`
          <h2>Client Objectives</h2>
          <p>Outline the client challenge, measurable outcomes, and engagement boundaries.</p>
          <h2>Deliverables Schedule</h2>
          <table>
            <thead><tr><th>Phase</th><th>Deliverable</th><th>Timeline</th></tr></thead>
            <tbody><tr><td>Phase 1</td><td>Discovery &amp; Baseline</td><td>Weeks 1–2</td></tr></tbody>
          </table>
        `),
      },
    },
  ];

  const exports: ExportJob[] = [
    {
      id: 'exp_101',
      workspaceId: 'ws_operations',
      documentId: 'doc_readiness_brief',
      versionId: 'ver_doc1_2',
      versionNo: 2,
      documentTitle: 'Q4 Operational Readiness Brief',
      format: 'pdf',
      status: 'ready',
      errorCode: null,
      requestedByName: 'Aria Chen',
      createdAt: '2026-11-26T09:20:00.000Z',
      completedAt: '2026-11-26T09:20:04.000Z',
    },
    {
      id: 'exp_102',
      workspaceId: 'ws_operations',
      documentId: 'doc_vendor_sop',
      versionId: 'ver_doc2_1',
      versionNo: 1,
      documentTitle: 'Vendor Onboarding Standard Procedure',
      format: 'docx',
      status: 'failed',
      errorCode: 'WORKER_TIMEOUT_RETRYABLE',
      requestedByName: 'Marcus Reed',
      createdAt: '2026-11-26T08:50:00.000Z',
      completedAt: '2026-11-26T08:50:12.000Z',
    },
  ];

  const auditEvents: AuditEvent[] = [
    {
      id: 'aud_1',
      workspaceId: 'ws_operations',
      actorId: user.id,
      actorName: user.displayName,
      action: 'auth.session_verified',
      entityType: 'workspace',
      entityId: 'ws_operations',
      entityLabel: 'Operations Studio',
      requestId: 'req_init_001',
      metadata: { mode: 'local_fixture' },
      createdAt: '2026-11-26T09:00:00.000Z',
    },
    {
      id: 'aud_2',
      workspaceId: 'ws_operations',
      actorId: 'usr_nadia_farooq',
      actorName: 'Nadia Farooq',
      action: 'document.version_saved',
      entityType: 'version',
      entityId: 'ver_doc1_2',
      entityLabel: 'Q4 Operational Readiness Brief (v2)',
      requestId: 'req_ver_002',
      metadata: { versionNo: 2, source: 'manual' },
      createdAt: '2026-11-26T09:15:00.000Z',
    },
    {
      id: 'aud_3',
      workspaceId: 'ws_operations',
      actorId: user.id,
      actorName: user.displayName,
      action: 'export.completed',
      entityType: 'export',
      entityId: 'exp_101',
      entityLabel: 'Q4 Operational Readiness Brief (PDF v2)',
      requestId: 'req_exp_003',
      metadata: { format: 'pdf', versionNo: 2 },
      createdAt: '2026-11-26T09:20:04.000Z',
    },
    {
      id: 'aud_4',
      workspaceId: 'ws_operations',
      actorId: 'usr_marcus_reed',
      actorName: 'Marcus Reed',
      action: 'export.failed',
      entityType: 'export',
      entityId: 'exp_102',
      entityLabel: 'Vendor Onboarding Standard Procedure (DOCX v1)',
      requestId: 'req_exp_004',
      metadata: { format: 'docx', errorCode: 'WORKER_TIMEOUT_RETRYABLE' },
      createdAt: '2026-11-26T08:50:12.000Z',
    },
  ];

  return {
    currentUser: user,
    activeWorkspaceId: 'ws_operations',
    workspaces,
    members,
    folders,
    documents,
    versions,
    templates,
    assets: [],
    exports,
    auditEvents,
  };
}

export function loadStudioState(): StudioState {
  if (typeof window === 'undefined') return makeSeedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = makeSeedState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as StudioState;
    if (!parsed || !Array.isArray(parsed.workspaces) || !Array.isArray(parsed.documents)) {
      return makeSeedState();
    }
    return parsed;
  } catch {
    return makeSeedState();
  }
}

export function saveStudioState(state: StudioState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota errors are surfaced via editor save state if needed
  }
}

export function resetStudioState(): StudioState {
  const seed = makeSeedState();
  saveStudioState(seed);
  return seed;
}

export function createAuditEntry(
  params: Omit<AuditEvent, 'id' | 'requestId' | 'createdAt'>
): AuditEvent {
  return {
    ...params,
    id: `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    requestId: generateRequestId(),
    createdAt: new Date().toISOString(),
  };
}
