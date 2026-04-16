// src/types.ts

// ─── Signal states (Sinalmatrix) ───────────────────────────────────────────

export interface SignalStateEntry {
  key: string | null;
  is: string | null;
  en: string | null;
}

export interface SignalState {
  id: string;
  type: string | null;
  states: Partial<Record<'00' | '01' | '10' | '11', SignalStateEntry>>;
}

// ─── Signal library (Merki) ────────────────────────────────────────────────

export type AlarmClass = 1 | 2 | 3;
export type SourceType = 'IED' | 'HARDWIRED';

export interface SignalLibraryEntry {
  code: string | null;
  name_is: string;
  description_is: string | null;
  name_en: string | null;
  state_id: string | null;
  signal_type: string | null;
  units: string | null;
  severity_code: string | null;
  hmi_event: boolean;
  is_alarm: boolean;
  alarm_class: AlarmClass | null;
  to_control_room: boolean;
  source_type: SourceType;
  iec61850_ld: string | null;
  iec61850_ln: string | null;
  iec61850_do_da: string | null;
  iec61850_fc: string | null;
  iec61850_cdc: string | null;
  iec61850_dataset: string | null;
  comments: string | null;
}

// ─── Project ───────────────────────────────────────────────────────────────

export type ProjectPhase = 'DESIGN' | 'FROZEN' | 'REVIEW' | 'FAT' | 'SAT';

export interface ProjectReview {
  reviewed_by: string;
  reviewed_at: string;
  status: 'OPEN' | 'APPROVED' | 'REJECTED';
  comment: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  created: string;
  phase: ProjectPhase;
  review: ProjectReview | null;
}

// ─── Equipment ─────────────────────────────────────────────────────────────

export type EquipmentCategory = 'apparatus' | 'ied';

export type ApparatusType =
  | 'Aflrofi'
  | 'Skilrofi'
  | 'Jarðrofi'
  | 'Spennir'
  | 'Stjórnbúnaður'
  | 'Annað';

/** @deprecated use ApparatusType */
export type EquipmentType = ApparatusType;

export interface Equipment {
  id: string;
  category: EquipmentCategory;  // 'apparatus' | 'ied'
  code: string;                  // Tech key, e.g. "QA1" or "Q0IED"
  // Apparatus fields
  type: ApparatusType | null;
  // IED fields
  ied_name: string | null;       // IEC 61850 IED name
  manufacturer: string | null;
  model: string | null;
  template_id: string | null;
  // Common
  description: string;
}

export interface EquipmentTemplate {
  id: string;
  name: string;                  // Display name, e.g. "Siemens 7SA87"
  category: EquipmentCategory;
  apparatus_type?: ApparatusType;
  manufacturer?: string;
  model?: string;
  description?: string;
}

// ─── Bay signal ────────────────────────────────────────────────────────────

export interface BaySignal {
  id: string;
  equipment_code: string;
  signal_name: string;
  name_is: string;
  name_en: string | null;
  state_id: string | null;
  // IEC 61850 — per IED instance
  iec61850_ied: string | null;         // IED name / tech key
  iec61850_ln_prefix: string | null;   // LN prefix
  iec61850_ln_inst: string | null;     // LN instance number
  iec61850_rcb: string | null;         // Report Control Block
  iec61850_dataset_entry: string | null; // Dataset entry
  // IEC 61850 — from signal library
  iec61850_ld: string | null;          // Logical Device
  iec61850_ln: string | null;          // Logical Node class
  iec61850_do_da: string | null;       // DO & DA
  iec61850_fc: string | null;          // Functional Constraint
  iec61850_cdc: string | null;         // Common Data Class
  iec61850_dataset: string | null;     // Dataset
  is_alarm: boolean;
  alarm_class: AlarmClass | null;
  source_type: SourceType;
  phase_added: ProjectPhase;
  fat_tested: boolean;
  fat_tested_by: string | null;
  fat_tested_at: string | null;
  sat_tested: boolean;
  sat_tested_by: string | null;
  sat_tested_at: string | null;
}

// ─── Bay ───────────────────────────────────────────────────────────────────

export interface Bay {
  id: string;
  station: string;
  voltage_level: string;
  bay_name: string;
  display_id: string;
  equipment_ids: string[];
  signals: BaySignal[];
}

// ─── Changelog ─────────────────────────────────────────────────────────────

export type ChangeType =
  | 'SIGNAL_ADDED'
  | 'SIGNAL_REMOVED'
  | 'FIELD_CHANGED'
  | 'PHASE_CHANGED'
  | 'REVIEW_ADDED'
  | 'FAT_TESTED'
  | 'SAT_TESTED';

export interface ChangeEntry {
  id: string;
  timestamp: string;
  user: string;
  phase: ProjectPhase;
  type: ChangeType;
  target_id: string;
  target_type: 'signal' | 'bay' | 'project' | 'equipment';
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  comment: string;
}

// ─── Testing ───────────────────────────────────────────────────────────────

export type TestResult = 'PASS' | 'FAIL' | 'SKIP';

export interface TestEntry {
  signal_id: string;
  phase: 'FAT' | 'SAT';
  result: TestResult;
  tested_by: string;
  tested_at: string;
  comment: string;
}

export interface Testing {
  fat_started: string | null;
  fat_completed: string | null;
  sat_started: string | null;
  sat_completed: string | null;
  entries: TestEntry[];
}

// ─── Bay template ──────────────────────────────────────────────────────────

export interface BayTemplate {
  template_name: string;
  station: string;
  voltage_level: string;
  bay_name: string;
  display_id: string;
  equipment_codes: string[];
  signals: Omit<BaySignal, 'phase_added'>[];
}

// ─── GitHub config ─────────────────────────────────────────────────────────

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}
