import { describe, it, expect } from 'vitest';
import { parseScd } from './scdParser';
import { flattenIedModelWithDataSets, parseModel } from './iedModelService';

// STUB1 kemur fyrst og hefur tóman LDevice (0 LDs með LN).
// CTRL1 hefur eitt LD með CSWI.Pos (DPC: stVal ST, ctlVal CO) og DataSet DS1
// sem vísar í Pos/stVal.
const SCD = `<?xml version="1.0"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL">
  <IED name="STUB1"><AccessPoint name="S1"><Server>
    <LDevice inst="LD0"></LDevice>
  </Server></AccessPoint></IED>
  <IED name="CTRL1"><AccessPoint name="S1"><Server>
    <LDevice inst="LD0">
      <LN0 lnClass="LLN0" lnType="LLN0type">
        <DataSet name="DS1">
          <FCDA ldInst="LD0" prefix="" lnClass="CSWI" lnInst="1" doName="Pos" daName="stVal" fc="ST"/>
        </DataSet>
      </LN0>
      <LN prefix="" lnClass="CSWI" inst="1" lnType="CSWItype"/>
    </LDevice>
  </Server></AccessPoint></IED>
  <DataTypeTemplates>
    <LNodeType id="LLN0type" lnClass="LLN0"/>
    <LNodeType id="CSWItype" lnClass="CSWI">
      <DO name="Pos" type="DPCtype"/>
    </LNodeType>
    <DOType id="DPCtype" cdc="DPC">
      <DA name="stVal" fc="ST" bType="Dbpos"/>
      <DA name="ctlVal" fc="CO" bType="BOOLEAN"/>
    </DOType>
  </DataTypeTemplates>
</SCL>`;

describe('flattenIedModelWithDataSets', () => {
  it('flatnar DO/DA og auðgar með DataSet nafni á réttri FCDA', () => {
    const { ieds } = parseScd(SCD);
    const ctrl = ieds.find(i => i.name === 'CTRL1')!;
    const fcda = flattenIedModelWithDataSets(ctrl, SCD);

    const pos = fcda.find(f => f.doName === 'Pos' && f.daName === 'stVal')!;
    expect(pos.dataset).toBe('DS1');

    const ctl = fcda.find(f => f.daName === 'ctlVal');
    expect(ctl).toBeDefined();
    expect(ctl!.dataset).toBeUndefined();
  });
});

describe('parseModel', () => {
  it('velur IED með flest LD og auðgar dataset', () => {
    const { fcda, iedName, error } = parseModel(SCD);
    expect(error).toBeUndefined();
    expect(iedName).toBe('CTRL1');
    expect(fcda.find(f => f.daName === 'stVal')?.dataset).toBe('DS1');
  });
});
