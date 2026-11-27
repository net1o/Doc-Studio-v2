import type { ExtractionSchemaTemplate } from './types';

export const FOLIO_BUILT_IN_PRESETS: ExtractionSchemaTemplate[] = [
  {
    id: 'trademark_journal',
    name: 'Trademark & Registry Journal',
    description:
      'Maps repeating trademark advertisements starting from Page 4 across page breaks into structured JournalCheck rows.',
    targetTableName: 'trademark_applications',
    defaultStartPage: 4,
    recordDelimiter: 'Advertised under section',
    stripHeaderPattern: '^THE TRADE MARKS JOURNAL',
    fields: [
      {
        name: 'application_no',
        type: 'string',
        description: 'Unique trademark application number',
        required: true,
        sourceLabels: ['Application No:', 'Application No'],
      },
      {
        name: 'title',
        type: 'string',
        description: 'Trademark title or wordmark',
        required: true,
        sourceLabels: ['Title:', 'Title'],
      },
      {
        name: 'class_no',
        type: 'number',
        description: 'Nice classification number',
        required: true,
        sourceLabels: ['Class:', 'Class'],
      },
      {
        name: 'goods_or_services',
        type: 'string',
        description: 'Goods or services specification',
        required: true,
        sourceLabels: ['Goods or services:', 'Goods or services'],
      },
      {
        name: 'applicant_name_address',
        type: 'string',
        description: 'Applicant name, trading style, and address',
        required: true,
        sourceLabels: [
          'Name and address of Applicant:',
          'Name and address',
          'of Applicant:',
        ],
      },
      {
        name: 'date_of_filing',
        type: 'date',
        description: 'Application filing date',
        required: true,
        sourceLabels: ['Date of filing:', 'Date of filing'],
      },
      {
        name: 'agent_name_address',
        type: 'string',
        description: 'Attorney or trademark agent details',
        required: false,
        sourceLabels: [
          "Agent's name And address:",
          'Agent’s name And address:',
          "Agent's name",
          'Agent’s name',
          'And address:',
        ],
      },
      {
        name: 'limitations_disclaimers',
        type: 'string',
        description: 'Limitations, conditions, and disclaimers imposed',
        required: false,
        sourceLabels: [
          'Description of limitations, conditions and disclaimers imposed:',
          'Description of limitations,',
          'conditions and disclaimers',
          'imposed:',
        ],
      },
      {
        name: 'advertised_under',
        type: 'string',
        description: 'Statutory section and rule citation',
        required: false,
        sourceLabels: ['Advertised under section'],
      },
      {
        name: 'page_number',
        type: 'number',
        description: 'Source PDF page number where entry starts',
        required: true,
        sourceLabels: ['__PAGE_NUMBER__'],
      },
    ],
  },
  {
    id: 'auto',
    name: 'Auto-Detect Schema',
    description:
      'Detects Trade Marks Journal markers, key-value pairs, and coordinate-aligned tables automatically.',
    targetTableName: 'extracted_documents',
    defaultStartPage: 1,
    fields: [
      {
        name: 'document_identifier',
        type: 'string',
        description: 'Primary reference number or application code',
        required: false,
        sourceLabels: ['Application No:', 'Invoice Number:', 'Receipt #', 'Reference:'],
      },
      {
        name: 'document_date',
        type: 'date',
        description: 'Primary issue or filing date',
        required: false,
        sourceLabels: ['Date of filing:', 'Invoice Date:', 'Date:'],
      },
      {
        name: 'organization_name',
        type: 'string',
        description: 'Issuing company, vendor, or entity name',
        required: false,
        sourceLabels: ['Vendor:', 'Company:', 'Account Name:'],
      },
    ],
  },
  {
    id: 'ledger',
    name: 'Financial Statement & Table Grid',
    description:
      'Captures multi-page aligned tables and borderless registry schedules across page breaks.',
    targetTableName: 'extracted_ledger_rows',
    defaultStartPage: 1,
    fields: [
      {
        name: 'account_name',
        type: 'string',
        description: 'Account or docket title',
        required: true,
        sourceLabels: ['Account Name:', 'Account:'],
      },
    ],
  },
];
