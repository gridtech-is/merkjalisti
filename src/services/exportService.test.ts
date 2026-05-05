import { describe, it, expect } from 'vitest';
import { exportZenonXml, exportZenonReactionMatrix, zenonTagCategory } from './exportService';
import type { BaySignal, SignalState, ApparatusType } from '../types';

function sig(overrides: Partial<BaySignal> = {}): BaySignal {
  return {
    id: '1', equipment_code: 'Q0', signal_name: 'CB_READY',
    name_is: 'AFLROFI', name_en: 'CIRCUIT READY', state_id: 'InActive',
    iec61850_ied: 'IED1', iec61850_ld: 'LD0',
    iec61850_ln: 'GGIO', iec61850_ln_prefix: null, iec61850_ln_inst: '22',
    iec61850_do: 'Ind', iec61850_da: 'stVal', iec61850_fc: 'ST', iec61850_cdc: 'SPS',
    iec61850_dataset: 'EV', iec61850_rcb: 'rEV', iec61850_dataset_entry: null,
    library_id: null, unit_id: null,
    is_alarm: false, alarm_class: null, state_alarm_map: null,
    source_type: 'IED', phase_added: 'DESIGN',
    fat_tested: false, fat_tested_by: null, fat_tested_at: null, fat_result: null,
    sat_tested: false, sat_tested_by: null, sat_tested_at: null, sat_result: null,
    review_flagged: false, review_comment: null,
    ...overrides,
  };
}

function state(overrides: Partial<SignalState> = {}): SignalState {
  return {
    id: 'InActive',
    type: 'SP',
    states: {
      '00': { key: 'X_INACTIVE', is: 'ÓVIRK', en: 'INACTIVE' },
      '01': { key: 'X_ACTIVE', is: 'VIRK', en: 'ACTIVE' },
    },
    ...overrides,
  };
}

const NO_STATES: SignalState[] = [];

describe('exportZenonXml', () => {
  it('generates a Variable element with correct SymbAddr', () => {
    const xml = exportZenonXml([sig()], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).toContain('<Name>BAY1_Q0_CB_READY</Name>');
    expect(xml).toContain('DriverID="4"');
    expect(xml).toContain('<SymbAddr>Server_IED1!LD0/GGIO22/Ind/stVal[ST]</SymbAddr>');
    expect(xml).toContain('TypeID="8"');
  });

  it('excludes signal missing iec61850_ied', () => {
    const xml = exportZenonXml([sig({ iec61850_ied: null })], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).not.toContain('<Variable ');
  });

  it('excludes signal missing iec61850_do', () => {
    const xml = exportZenonXml([sig({ iec61850_do: null })], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).not.toContain('<Variable ');
  });

  it('maps CDC DPS to UDINT (TypeID=5)', () => {
    const xml = exportZenonXml([sig({ iec61850_cdc: 'DPS' })], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).toContain('TypeID="5"');
  });

  it('maps CDC MV to REAL (TypeID=11)', () => {
    const xml = exportZenonXml([sig({ iec61850_cdc: 'MV' })], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).toContain('TypeID="11"');
  });

  it('defaults unknown CDC to BOOL (TypeID=8)', () => {
    const xml = exportZenonXml([sig({ iec61850_cdc: 'UNKNOWN' })], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).toContain('TypeID="8"');
  });

  it('generates Tagname as "{bayName} @{category}"', () => {
    const xml = exportZenonXml([sig()], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).toContain('<Tagname>BAY1 @PROTECTION</Tagname>');
  });

  it('uses group_label as tag category when set', () => {
    const xml = exportZenonXml([sig({ group_label: 'CIRCUIT BREAKER' })], NO_STATES, 'IEC850', '55E00');
    expect(xml).toContain('<Tagname>55E00 @CIRCUIT BREAKER</Tagname>');
  });

  it('falls back to zenonTagCategory when group_label is null', () => {
    const xml = exportZenonXml([sig({ group_label: null, iec61850_ln: 'XCBR' })], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).toContain('<Tagname>BAY1 @CIRCUIT BREAKER</Tagname>');
  });

  it('RecourcesLabel uses signal_name', () => {
    const xml = exportZenonXml([sig()], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).toContain('<RecourcesLabel>@CB_READY</RecourcesLabel>');
  });

  it('sanitizes variable name: dots become underscores', () => {
    const xml = exportZenonXml([sig({ equipment_code: 'Q0', signal_name: 'CB.READY' })], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).toContain('<Name>BAY1_Q0_CB_READY</Name>');
  });

  it('includes ClassName in Limits_1 when is_alarm and alarm_class set', () => {
    const xml = exportZenonXml([sig({ is_alarm: true, alarm_class: 2 })], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).toContain('<ClassName>2</ClassName>');
  });

  it('omits non-empty ClassName when is_alarm is false', () => {
    const xml = exportZenonXml([sig({ is_alarm: false, alarm_class: null })], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).not.toContain('<ClassName>2</ClassName>');
  });

  it('includes [ST] FC bracket in SymbAddr', () => {
    const xml = exportZenonXml([sig({ iec61850_fc: 'ST' })], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).toContain('[ST]');
  });

  it('omits /da segment when iec61850_da is null', () => {
    const xml = exportZenonXml([sig({ iec61850_da: null })], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).toContain('<SymbAddr>Server_IED1!LD0/GGIO22/Ind[ST]</SymbAddr>');
  });

  it('uses version 15000', () => {
    const xml = exportZenonXml([sig()], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).toContain('MainVersion="15000"');
    expect(xml).toContain('Version="15000"');
  });

  it('includes driver apartment with IEC850 module', () => {
    const xml = exportZenonXml([sig()], NO_STATES, 'IEC850', 'BAY1');
    expect(xml).toContain('<Apartment ShortName="zenOn(R) driver list"');
    expect(xml).toContain('<Modul>IEC850</Modul>');
  });

  it('uses netAddrMap for NetAddr when IED is in map', () => {
    const xml = exportZenonXml([sig()], NO_STATES, 'IEC850', 'BAY1', { IED1: 5 });
    expect(xml).toContain('<NetAddr>5</NetAddr>');
  });

  it('falls back to 0 when IED not in netAddrMap', () => {
    const xml = exportZenonXml([sig()], NO_STATES, 'IEC850', 'BAY1', {});
    expect(xml).toContain('<NetAddr>0</NetAddr>');
  });
});

describe('zenonTagCategory', () => {
  const map = (overrides: Partial<BaySignal> = {}) => sig(overrides);
  const typeMap = (code: string, type: ApparatusType): Record<string, ApparatusType> => ({ [code]: type });

  it('XCBR → CIRCUIT BREAKER', () => {
    expect(zenonTagCategory(map({ iec61850_ln: 'XCBR' }))).toBe('CIRCUIT BREAKER');
  });

  it('XSWI → DISCONNECTOR by default', () => {
    expect(zenonTagCategory(map({ iec61850_ln: 'XSWI' }))).toBe('DISCONNECTOR');
  });

  it('XSWI + Jarðrofi apparatus → EARTHING SWITCH', () => {
    expect(zenonTagCategory(map({ iec61850_ln: 'XSWI', equipment_code: 'QC1' }), typeMap('QC1', 'Jarðrofi'))).toBe('EARTHING SWITCH');
  });

  it('MV CDC → MEASUREMENT', () => {
    expect(zenonTagCategory(map({ iec61850_cdc: 'MV', iec61850_ln: 'MMXU' }))).toBe('MEASUREMENT');
  });

  it('CMV CDC → MEASUREMENT', () => {
    expect(zenonTagCategory(map({ iec61850_cdc: 'CMV', iec61850_ln: 'GGIO' }))).toBe('MEASUREMENT');
  });

  it('INS CDC → MEASUREMENT', () => {
    expect(zenonTagCategory(map({ iec61850_cdc: 'INS', iec61850_ln: 'MMTR' }))).toBe('MEASUREMENT');
  });

  it('MMXU lnClass → MEASUREMENT', () => {
    expect(zenonTagCategory(map({ iec61850_ln: 'MMXU', iec61850_cdc: 'SPS' }))).toBe('MEASUREMENT');
  });

  it('PTOC → PROTECTION', () => {
    expect(zenonTagCategory(map({ iec61850_ln: 'PTOC' }))).toBe('PROTECTION');
  });

  it('LGOS → PROTECTION', () => {
    expect(zenonTagCategory(map({ iec61850_ln: 'LGOS' }))).toBe('PROTECTION');
  });

  it('GGIO with DO=Loc → LOCAL/REMOTE', () => {
    expect(zenonTagCategory(map({ iec61850_ln: 'GGIO', iec61850_do: 'Loc' }))).toBe('LOCAL/REMOTE');
  });

  it('LCCH → NETWORK', () => {
    expect(zenonTagCategory(map({ iec61850_ln: 'LCCH' }))).toBe('NETWORK');
  });

  it('unknown lnClass → PROTECTION (fallback)', () => {
    expect(zenonTagCategory(map({ iec61850_ln: 'GGIO', iec61850_do: 'Ind' }))).toBe('PROTECTION');
  });
});

describe('exportZenonReactionMatrix', () => {
  it('generates Rematrix with State_0, State_1, State_2 for SP state', () => {
    const xml = exportZenonReactionMatrix([sig()], [state()]);
    expect(xml).toContain('<Rematrix ShortName="InActive" TypeID="1">');
    expect(xml).toContain('<State_0 ');
    expect(xml).toContain('<State_1 ');
    expect(xml).toContain('<State_2 ');
    expect(xml).not.toContain('<State_3 ');
  });

  it('State_0 is catch-all: Status=0, ReaWertMaske=0', () => {
    const xml = exportZenonReactionMatrix([sig()], [state()]);
    expect(xml).toMatch(/<State_0[^>]*>[\s\S]*?<Status>0<\/Status>[\s\S]*?<ReaWertMaske>0<\/ReaWertMaske>/);
  });

  it('SP State_1 has ReaWert=0 ReaWertMaske=1, State_2 has ReaWert=1', () => {
    const xml = exportZenonReactionMatrix([sig()], [state()]);
    expect(xml).toContain('<ReaWert>0</ReaWert><ReaWertMaske>1</ReaWertMaske>');
    expect(xml).toContain('<ReaWert>1</ReaWert><ReaWertMaske>1</ReaWertMaske>');
  });

  it('generates State_0..State_4 for DP state with TypeID=2', () => {
    const dpState = state({
      id: 'OpenCloseDP', type: 'DP',
      states: {
        '00': { key: 'X_INT', is: 'MILLIBIL', en: 'INTERMEDIATE' },
        '01': { key: 'X_OPEN', is: 'OPINN', en: 'OPEN' },
        '10': { key: 'X_CLOSED', is: 'LOKAÐUR', en: 'CLOSED' },
        '11': { key: 'X_BAD', is: 'VILLA', en: 'DISTURBED' },
      },
    });
    const xml = exportZenonReactionMatrix([sig({ state_id: 'OpenCloseDP' })], [dpState]);
    expect(xml).toContain('<Rematrix ShortName="OpenCloseDP" TypeID="2">');
    expect(xml).toContain('<State_4 ');
    expect(xml).not.toContain('<State_5 ');
    // DPI uses CheckArt=3 (enum-based matching), not ReaWertMaske bit masking
    expect(xml).toContain('<CheckArt>3</CheckArt>');
  });

  it('signal with state_id=null produces no Rematrix', () => {
    const xml = exportZenonReactionMatrix([sig({ state_id: null })], [state()]);
    expect(xml).not.toContain('<Rematrix');
  });

  it('unknown state_id is skipped gracefully', () => {
    const xml = exportZenonReactionMatrix([sig({ state_id: 'UNKNOWN' })], [state()]);
    expect(xml).not.toContain('<Rematrix');
  });

  it('two signals sharing state_id produce only one Rematrix', () => {
    const xml = exportZenonReactionMatrix([sig(), sig({ id: '2' })], [state()]);
    const count = (xml.match(/<Rematrix /g) ?? []).length;
    expect(count).toBe(1);
  });

  it('state_alarm_map sets KlasseIdx and Status=513', () => {
    const s = sig({
      state_alarm_map: { '01': { is_alarm: true, is_event: false, alarm_class: 2 } },
    });
    const xml = exportZenonReactionMatrix([s], [state()]);
    expect(xml).toContain('<KlasseIdx>2</KlasseIdx>');
    expect(xml).toContain('<Status>513</Status>');
  });

  it('signal-level alarm applies to non-00 states when no state_alarm_map', () => {
    const s = sig({ is_alarm: true, alarm_class: 1, state_alarm_map: null });
    const xml = exportZenonReactionMatrix([s], [state()]);
    expect(xml).toContain('<KlasseIdx>1</KlasseIdx>');
  });

  it('uses @key as Text in state blocks', () => {
    const st = state({
      states: {
        '00': { key: 'X_OFF', is: 'SLÖKKT', en: 'OFF' },
        '01': { key: 'X_ON', is: 'KVEIKT', en: null },
      },
    });
    const xml = exportZenonReactionMatrix([sig()], [st]);
    expect(xml).toContain('<Text>@X_OFF</Text>');
    expect(xml).toContain('<Text>@X_ON</Text>');
  });

  it('uses version 15000', () => {
    const xml = exportZenonReactionMatrix([sig()], [state()]);
    expect(xml).toContain('MainVersion="15000"');
  });
});
