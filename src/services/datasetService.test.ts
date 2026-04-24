import { describe, it, expect } from 'vitest';
import { insertDataSetsIntoIcd } from './datasetService';
import type { BaySignal } from '../types';

const ICD = `<?xml version="1.0"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL">
  <IED name="F2540C01">
    <AccessPoint name="S1">
      <Server>
        <LDevice inst="LD0">
          <LN0 lnClass="LLN0" lnType="LLN01"/>
        </LDevice>
      </Server>
    </AccessPoint>
  </IED>
</SCL>`;

function sig(overrides: Partial<BaySignal> = {}): BaySignal {
  return {
    id: '1', equipment_code: 'Q0', signal_name: 'Pos.DP',
    name_is: 'test', name_en: null, state_id: null,
    iec61850_ied: 'F245C01',
    iec61850_ln_prefix: 'S', iec61850_ln_inst: '1',
    iec61850_rcb: 'rEV', iec61850_dataset_entry: null,
    iec61850_ld: 'LD0', iec61850_ln: 'CSWI',
    iec61850_do: 'Pos', iec61850_da: 'stVal',
    iec61850_fc: 'ST', iec61850_cdc: 'DPC',
    iec61850_dataset: 'EV',
    library_id: null, unit_id: null,
    is_alarm: false, alarm_class: null, state_alarm_map: null,
    source_type: 'IED', phase_added: 'DESIGN',
    fat_tested: false, fat_tested_by: null, fat_tested_at: null, fat_result: null,
    sat_tested: false, sat_tested_by: null, sat_tested_at: null, sat_result: null,
    review_flagged: false, review_comment: null,
    ...overrides,
  };
}

describe('insertDataSetsIntoIcd', () => {
  it('inserts DataSet and ReportControl', () => {
    const result = insertDataSetsIntoIcd(ICD, [sig()], 'F2540C01');
    expect(result).not.toBeNull();
    expect(result).toContain('DataSet');
    expect(result).toContain('ReportControl');
  });

  it('DataSet has correct name', () => {
    const result = insertDataSetsIntoIcd(ICD, [sig()], 'F2540C01')!;
    expect(result).toContain('name="EV"');
  });

  it('ReportControl has correct name and rptID', () => {
    const result = insertDataSetsIntoIcd(ICD, [sig()], 'F2540C01')!;
    expect(result).toContain('name="rEV"');
    expect(result).toContain('rptID="F2540C01LD0/LLN0.rEV"');
  });

  it('ST signal gives buffered RCB', () => {
    const result = insertDataSetsIntoIcd(ICD, [sig({ iec61850_fc: 'ST' })], 'F2540C01')!;
    expect(result).toContain('buffered="true"');
    expect(result).toContain('bufTime="500"');
  });

  it('skips N/A dataset signals', () => {
    const result = insertDataSetsIntoIcd(ICD, [sig({ iec61850_dataset: 'N/A' })], 'F2540C01');
    expect(result).toBeNull();
  });

  it('FCDA has correct attributes', () => {
    const result = insertDataSetsIntoIcd(ICD, [sig()], 'F2540C01')!;
    expect(result).toContain('ldInst="LD0"');
    expect(result).toContain('lnClass="CSWI"');
    expect(result).toContain('doName="Pos"');
    expect(result).toContain('fc="ST"');
  });

});
