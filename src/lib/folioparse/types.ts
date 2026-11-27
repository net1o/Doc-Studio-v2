export type SupportedMimeType =
  | 'application/pdf'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/tiff';

export type OcrMode = 'high_accuracy' | 'fast';

export interface ExtractedField {
  key: string;
  value: string;
  dataType: 'string' | 'number' | 'currency' | 'date' | 'boolean';
  confidence: 'high' | 'medium' | 'low';
  pageNumber: number;
}

export interface FolioTableRow {
  cells: string[];
}

export interface ExtractedTable {
  title: string;
  formatType: 'bordered_grid' | 'borderless_aligned' | 'key_value_matrix' | 'multi_page_ledger';
  pageRange: string;
  headers: string[];
  rows: FolioTableRow[];
}

export interface OcrPage {
  pageNumber: number;
  text: string;
  confidenceNote: string;
}

export interface SchemaFieldDef {
  name: string;
  type: 'string' | 'number' | 'currency' | 'date' | 'boolean';
  description: string;
  required: boolean;
  sourceLabels?: string[];
}

export interface ExtractionSchemaTemplate {
  id: string;
  name: string;
  description: string;
  targetTableName: string;
  defaultStartPage?: number;
  recordDelimiter?: string;
  stripHeaderPattern?: string;
  fields: SchemaFieldDef[];
}

export interface FolioParseDocumentResult {
  id: string;
  fileName: string;
  mimeType: SupportedMimeType;
  fileSizeBytes: number;
  pageCount: number;
  startPage: number;
  endPage: number;
  schemaPreset: string;
  documentType: string;
  ocrUsed: boolean;
  summary: string;
  fields: ExtractedField[];
  tables: ExtractedTable[];
  ocrPages: OcrPage[];
}
