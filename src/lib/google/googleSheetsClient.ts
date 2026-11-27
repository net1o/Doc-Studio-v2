import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';
import { CaseEntry } from '../../types/journal';
import { CaseLookupImportOptions, exportRowsToCsv, parseCaseLookupInput } from '../journal/engine';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Strictly in-memory OAuth access token cache (never persisted to localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export interface GoogleDriveSpreadsheetItem {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface GoogleSheetTabInfo {
  sheetId: number;
  title: string;
  rowCount?: number;
  columnCount?: number;
}

export interface GoogleSpreadsheetMeta {
  spreadsheetId: string;
  title: string;
  sheets: GoogleSheetTabInfo[];
}

export const CANONICAL_CASE_SHEET_HEADERS = [
  'ID',
  'DATE',
  'TYPE',
  'CLIENT CODE',
  'CASE NUMBER',
  'CLIENT NAME',
  'APPLICATION NAME',
  'TM/CPR NUMBER',
  'CLASS',
  'STATUS',
  'SUB STATUS',
  'CASE TYPE',
  'AGENT',
  'OFF NOTE',
  'NOTES',
  'TM5',
  'TM6',
  'TM11',
  'TM16',
  'TM56',
  'JOURNAL NUMBER',
  'JOURNAL DATE',
  'LAST MODIFIED',
  'IMAGE',
];

export function extractSpreadsheetId(sheetUrlOrId: string): string {
  const raw = String(sheetUrlOrId || '').trim();
  if (!raw) return '';
  const urlMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(raw)) return raw;
  return '';
}

export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearGoogleAccessToken(): void {
  cachedAccessToken = null;
}

export function initGoogleAuthListener(
  onUserChange: (user: User | null, accessToken: string | null) => void
): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedAccessToken = null;
      onUserChange(null, null);
    } else {
      onUserChange(user, cachedAccessToken);
    }
  });
}

export async function signInWithGoogleWorkspace(): Promise<{
  user: User;
  accessToken: string | null;
}> {
  const provider = new GoogleAuthProvider();
  for (const scope of GOOGLE_SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({
    prompt: 'consent',
    access_type: 'online',
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  cachedAccessToken = credential?.accessToken || null;

  return {
    user: result.user,
    accessToken: cachedAccessToken,
  };
}

export async function signOutGoogleWorkspace(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

async function googleApiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!cachedAccessToken) {
    throw new Error('NEEDS_GOOGLE_AUTH');
  }
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${cachedAccessToken}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 || res.status === 403) {
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('NEEDS_GOOGLE_AUTH');
    }
  }
  return res;
}

export async function listUserSpreadsheets(): Promise<GoogleDriveSpreadsheetItem[]> {
  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=30`;
  const res = await googleApiFetch(url);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive API error (${res.status}): ${errText.slice(0, 140)}`);
  }
  const data = (await res.json()) as { files?: GoogleDriveSpreadsheetItem[] };
  return data.files || [];
}

export async function getSpreadsheetMetadata(
  spreadsheetId: string
): Promise<GoogleSpreadsheetMeta> {
  const id = extractSpreadsheetId(spreadsheetId);
  if (!id) throw new Error('Invalid Google Spreadsheet ID or URL.');

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    id
  )}?fields=spreadsheetId,properties.title,sheets.properties`;
  const res = await googleApiFetch(url);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sheets metadata error (${res.status}): ${errText.slice(0, 140)}`);
  }

  const data = (await res.json()) as {
    spreadsheetId: string;
    properties?: { title?: string };
    sheets?: Array<{
      properties?: {
        sheetId?: number;
        title?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  };

  return {
    spreadsheetId: data.spreadsheetId || id,
    title: data.properties?.title || 'Untitled Spreadsheet',
    sheets: (data.sheets || []).map((s) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title || 'Sheet1',
      rowCount: s.properties?.gridProperties?.rowCount,
      columnCount: s.properties?.gridProperties?.columnCount,
    })),
  };
}

export async function readGoogleSheetViaApi(
  spreadsheetIdOrUrl: string,
  requestedTabName?: string,
  options: CaseLookupImportOptions = {}
): Promise<{
  entries: CaseEntry[];
  spreadsheetTitle: string;
  sheetTitle: string;
  availableTabs: GoogleSheetTabInfo[];
  totalSheetRows: number;
  blankTmRows: number;
}> {
  const id = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!id) throw new Error('Invalid Google Spreadsheet URL or ID.');

  const meta = await getSpreadsheetMetadata(id);
  const availableTabs = meta.sheets;
  if (availableTabs.length === 0) {
    throw new Error('This Google Spreadsheet has no sheet tabs.');
  }

  const trimmedReq = (requestedTabName || '').trim();
  const matchedTab =
    availableTabs.find((t) => t.title.toLowerCase() === trimmedReq.toLowerCase()) ||
    availableTabs[0];
  const targetTitle = matchedTab.title;

  const range = encodeURIComponent(`${targetTitle}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    id
  )}/values/${range}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`;

  const res = await googleApiFetch(url);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sheets read error (${res.status}): ${errText.slice(0, 140)}`);
  }

  const payload = (await res.json()) as { values?: string[][] };
  const matrix = payload.values || [];
  if (matrix.length === 0) {
    return {
      entries: [],
      spreadsheetTitle: meta.title,
      sheetTitle: targetTitle,
      availableTabs,
      totalSheetRows: 0,
      blankTmRows: 0,
    };
  }

  // Convert 2D matrix into CSV so header-detection and 24-column parsing stay 100% consistent
  const csv = exportRowsToCsv(matrix[0] || [], matrix.slice(1));
  const parsed = parseCaseLookupInput(csv, {
    ...options,
    preserveDuplicateTms: true,
  });

  return {
    entries: parsed.entries,
    spreadsheetTitle: meta.title,
    sheetTitle: targetTitle,
    availableTabs,
    totalSheetRows: parsed.totalCsvRows,
    blankTmRows: parsed.blankTmRows,
  };
}

export function caseEntryToSheetRow(c: CaseEntry): string[] {
  return [
    c.id || '',
    c.date || '',
    c.prefix || '',
    c.clientCode || '',
    c.rawCaseNo || c.caseNo || '',
    c.clientName || '',
    c.applicationName || '',
    c.tmNumber || '',
    c.classNo || '',
    c.status || '',
    c.subStatus || '',
    c.caseType || '',
    c.agent || '',
    c.offNote || '',
    c.notes || '',
    c.tm5 || 'FALSE',
    c.tm6 || 'FALSE',
    c.tm11 || 'FALSE',
    c.tm16 || 'FALSE',
    c.tm56 || 'FALSE',
    c.journalNumber || '',
    c.journalDate || '',
    c.lastModified || '',
    c.imageUrl || '',
  ];
}

export async function writeCaseEntriesToGoogleSheet(
  spreadsheetIdOrUrl: string,
  requestedTabName: string,
  entries: CaseEntry[]
): Promise<{
  updatedRows: number;
  sheetTitle: string;
  spreadsheetTitle: string;
}> {
  const id = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!id) throw new Error('Invalid Google Spreadsheet URL or ID.');

  const meta = await getSpreadsheetMetadata(id);
  const trimmedReq = (requestedTabName || '').trim();
  const matchedTab =
    meta.sheets.find((t) => t.title.toLowerCase() === trimmedReq.toLowerCase()) || meta.sheets[0];
  if (!matchedTab) throw new Error('No destination sheet tab found.');

  const targetTitle = matchedTab.title;
  const rowsMatrix: string[][] = [
    CANONICAL_CASE_SHEET_HEADERS,
    ...entries.map(caseEntryToSheetRow),
  ];

  // Clear existing sheet values first so removed rows don't linger at the bottom
  const clearRange = encodeURIComponent(`${targetTitle}!A1:Z`);
  await googleApiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${clearRange}:clear`,
    { method: 'POST', body: JSON.stringify({}) }
  );

  const writeRange = encodeURIComponent(`${targetTitle}!A1:X${rowsMatrix.length}`);
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    id
  )}/values/${writeRange}?valueInputOption=USER_ENTERED`;

  const res = await googleApiFetch(updateUrl, {
    method: 'PUT',
    body: JSON.stringify({
      range: `${targetTitle}!A1:X${rowsMatrix.length}`,
      majorDimension: 'ROWS',
      values: rowsMatrix,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sheets write error (${res.status}): ${errText.slice(0, 160)}`);
  }

  return {
    updatedRows: entries.length,
    sheetTitle: targetTitle,
    spreadsheetTitle: meta.title,
  };
}
