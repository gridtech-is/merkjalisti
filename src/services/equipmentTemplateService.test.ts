// src/services/equipmentTemplateService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyTemplateToBay,
  createTemplateFromIED,
  listEquipmentTemplates,
  saveEquipmentTemplate,
  deleteEquipmentTemplate,
} from './equipmentTemplateService';
import type { BaySignal, EquipmentTemplate } from '../types';

function makeBaySignal(overrides: Partial<BaySignal> = {}): BaySignal {
  return {
    id: 'sig-1',
    equipment_code: 'Q0IED',
    signal_name: 'Pos.stVal',
    name_is: 'Staða',
    name_en: null,
    state_id: null,
    library_id: 'lib-1',
    iec61850_ied: null,
    iec61850_ln_prefix: null,
    iec61850_ln_inst: null,
    iec61850_rcb: null,
    iec61850_dataset_entry: null,
    iec61850_ld: null,
    iec61850_ln: null,
    iec61850_do: null,
    iec61850_da: null,
    iec61850_fc: null,
    iec61850_cdc: null,
    iec61850_dataset: null,
    is_alarm: false,
    alarm_class: null,
    state_alarm_map: null,
    source_type: 'IED',
    phase_added: 'DESIGN',
    fat_tested: false,
    fat_tested_by: null,
    fat_tested_at: null,
    fat_result: null,
    sat_tested: false,
    sat_tested_by: null,
    sat_tested_at: null,
    sat_result: null,
    review_flagged: false,
    review_comment: null,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<EquipmentTemplate> = {}): EquipmentTemplate {
  return {
    id: 'tmpl-1',
    name: 'Test template',
    category: 'ied',
    signals: [],
    ...overrides,
  };
}

describe('applyTemplateToBay', () => {
  it('uppfærir IEC61850 á merki sem passar við library_id og equipment_code', () => {
    const template = makeTemplate({
      signals: [{
        id: 'ts-1',
        library_id: 'lib-1',
        signal_name: 'Pos.stVal',
        ld_inst: 'PROT',
        prefix: 'Q0',
        ln_class: 'XCBR',
        ln_inst: '1',
        do_name: 'Pos',
        da_name: 'stVal',
      }],
    });
    const signals = [makeBaySignal({ equipment_code: 'Q0IED', library_id: 'lib-1', signal_name: 'Pos.stVal' })];

    const { updated, matchedCount, skippedCount } = applyTemplateToBay(template, 'Q0IED', signals);

    expect(matchedCount).toBe(1);
    expect(skippedCount).toBe(0);
    expect(updated[0].iec61850_ld).toBe('PROT');
    expect(updated[0].iec61850_ln_prefix).toBe('Q0');
    expect(updated[0].iec61850_ln).toBe('XCBR');
    expect(updated[0].iec61850_ln_inst).toBe('1');
    expect(updated[0].iec61850_do).toBe('Pos');
    expect(updated[0].iec61850_da).toBe('stVal');
  });

  it('notar signal_name sem tiebreaker þegar fleiri en eitt merki passar við library_id', () => {
    const template = makeTemplate({
      signals: [
        { id: 'ts-1', library_id: 'lib-1', signal_name: 'Pos.stVal', ld_inst: 'PROT', prefix: null, ln_class: 'XCBR', ln_inst: '1', do_name: 'Pos', da_name: 'stVal' },
        { id: 'ts-2', library_id: 'lib-1', signal_name: 'Pos.q',     ld_inst: 'PROT', prefix: null, ln_class: 'XCBR', ln_inst: '1', do_name: 'Pos', da_name: 'q'    },
      ],
    });
    const signals = [
      makeBaySignal({ id: 'sig-a', equipment_code: 'Q0IED', library_id: 'lib-1', signal_name: 'Pos.stVal' }),
      makeBaySignal({ id: 'sig-b', equipment_code: 'Q0IED', library_id: 'lib-1', signal_name: 'Pos.q' }),
    ];

    const { updated, matchedCount } = applyTemplateToBay(template, 'Q0IED', signals);

    expect(matchedCount).toBe(2);
    const a = updated.find(s => s.id === 'sig-a')!;
    const b = updated.find(s => s.id === 'sig-b')!;
    expect(a.iec61850_da).toBe('stVal');
    expect(b.iec61850_da).toBe('q');
  });

  it('sleppir merkjum sem eru ekki í sniðmátinu', () => {
    const template = makeTemplate({ signals: [] });
    const signals = [makeBaySignal({ equipment_code: 'Q0IED', library_id: 'lib-1' })];

    const { updated, matchedCount, skippedCount } = applyTemplateToBay(template, 'Q0IED', signals);

    expect(matchedCount).toBe(0);
    expect(skippedCount).toBe(1);
    expect(updated[0].iec61850_ld).toBeNull();
  });

  it('snertir ekki merki með annan equipment_code', () => {
    const template = makeTemplate({
      signals: [{ id: 'ts-1', library_id: 'lib-1', signal_name: 'Pos.stVal', ld_inst: 'PROT', prefix: null, ln_class: 'XCBR', ln_inst: '1', do_name: 'Pos', da_name: 'stVal' }],
    });
    const signals = [makeBaySignal({ equipment_code: 'OTHER', library_id: 'lib-1' })];

    const { updated, matchedCount } = applyTemplateToBay(template, 'Q0IED', signals);

    expect(matchedCount).toBe(0);
    expect(updated[0].iec61850_ld).toBeNull();
  });

  it('setur do og da null þegar þau eru null í sniðmátinu', () => {
    const template = makeTemplate({
      signals: [{ id: 'ts-1', library_id: 'lib-1', signal_name: 'Pos.stVal', ld_inst: 'PROT', prefix: null, ln_class: 'XCBR', ln_inst: '1', do_name: null, da_name: null }],
    });
    const signals = [makeBaySignal({ equipment_code: 'Q0IED', library_id: 'lib-1', signal_name: 'Pos.stVal' })];

    const { updated } = applyTemplateToBay(template, 'Q0IED', signals);

    expect(updated[0].iec61850_do).toBeNull();
    expect(updated[0].iec61850_da).toBeNull();
  });
});

describe('createTemplateFromIED', () => {
  const mockApi = { writeJson: vi.fn(), readJson: vi.fn() };

  beforeEach(() => {
    mockApi.writeJson.mockReset();
    mockApi.readJson.mockReset();
  });

  it('síar baySignals eftir equipment_code og fangar IEC61850 svæði', async () => {
    mockApi.writeJson.mockResolvedValue('sha-new');
    mockApi.readJson.mockRejectedValue(new Error('not found'));

    const baySignals: BaySignal[] = [
      makeBaySignal({
        id: 'sig-1', equipment_code: 'Q0IED', library_id: 'lib-1', signal_name: 'Pos.stVal',
        iec61850_ld: 'PROT', iec61850_ln_prefix: 'Q0', iec61850_ln: 'XCBR',
        iec61850_ln_inst: '1', iec61850_do: 'Pos', iec61850_da: 'stVal',
      }),
      makeBaySignal({ id: 'sig-2', equipment_code: 'OTHER', library_id: 'lib-2', signal_name: 'Foo' }),
    ];

    const { template } = await createTemplateFromIED(mockApi as never, {
      name: 'Siemens 7SA87',
      edition: '2',
      manufacturer: 'Siemens',
      model: '7SA87',
      iedCode: 'Q0IED',
      baySignals,
    });

    expect(template.signals).toHaveLength(1);
    const s = template.signals[0];
    expect(s.library_id).toBe('lib-1');
    expect(s.signal_name).toBe('Pos.stVal');
    expect(s.ld_inst).toBe('PROT');
    expect(s.prefix).toBe('Q0');
    expect(s.ln_class).toBe('XCBR');
    expect(s.ln_inst).toBe('1');
    expect(s.do_name).toBe('Pos');
    expect(s.da_name).toBe('stVal');
  });

  it('kastar villu ef merki vantar library_id', async () => {
    const baySignals: BaySignal[] = [
      makeBaySignal({ equipment_code: 'Q0IED', library_id: null }),
    ];

    await expect(
      createTemplateFromIED(mockApi as never, {
        name: 'Test', edition: '2', iedCode: 'Q0IED', baySignals,
      })
    ).rejects.toThrow('library_id');
  });

  it('skrifar template á réttan slóð', async () => {
    mockApi.writeJson.mockResolvedValue('sha-new');
    mockApi.readJson.mockRejectedValue(new Error('not found'));

    const { template } = await createTemplateFromIED(mockApi as never, {
      name: 'Test', edition: '2', iedCode: 'Q0IED',
      baySignals: [makeBaySignal({ equipment_code: 'Q0IED', library_id: 'lib-1' })],
    });

    expect(mockApi.writeJson).toHaveBeenCalledOnce();
    const [path] = mockApi.writeJson.mock.calls[0] as [string, unknown];
    expect(path).toBe(`data/equipment_templates/${template.id}.json`);
  });
});

// ─── CRUD ─────────────────────────────────────────────────────────────────────

describe('listEquipmentTemplates', () => {
  it('skilar tóman lista þegar mappan er tóm', async () => {
    const api = { listDirectory: vi.fn().mockResolvedValue([]) };
    const result = await listEquipmentTemplates(api as never);
    expect(result).toEqual([]);
  });

  it('skilar tóman lista þegar mappan er ekki til', async () => {
    const api = { listDirectory: vi.fn().mockRejectedValue(new Error('not found')) };
    const result = await listEquipmentTemplates(api as never);
    expect(result).toEqual([]);
  });

  it('les hverja template skrá', async () => {
    const tmpl: EquipmentTemplate = { id: 'uuid-1', name: 'Test', category: 'ied', signals: [] };
    const api = {
      listDirectory: vi.fn().mockResolvedValue(['uuid-1.json']),
      readJson: vi.fn().mockResolvedValue({ data: tmpl, sha: 'sha1' }),
    };
    const result = await listEquipmentTemplates(api as never);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('uuid-1');
  });
});

describe('saveEquipmentTemplate', () => {
  it('skrifar nýtt template með sha=null', async () => {
    const api = { writeJson: vi.fn().mockResolvedValue('sha-new') };
    const tmpl: EquipmentTemplate = { id: 'uuid-1', name: 'Test', category: 'ied', signals: [] };
    const file = { template: tmpl, sha: '' };

    const result = await saveEquipmentTemplate(api as never, file, true);

    expect(api.writeJson).toHaveBeenCalledWith(
      'data/equipment_templates/uuid-1.json',
      tmpl,
      null,
      expect.any(String),
    );
    expect(result.sha).toBe('sha-new');
  });

  it('skrifar með gildandi sha þegar uppfært', async () => {
    const api = { writeJson: vi.fn().mockResolvedValue('sha-new') };
    const tmpl: EquipmentTemplate = { id: 'uuid-1', name: 'Test', category: 'ied', signals: [] };
    const file = { template: tmpl, sha: 'sha-old' };

    await saveEquipmentTemplate(api as never, file, false);

    expect(api.writeJson).toHaveBeenCalledWith(
      'data/equipment_templates/uuid-1.json',
      tmpl,
      'sha-old',
      expect.any(String),
    );
  });
});

describe('deleteEquipmentTemplate', () => {
  it('kallar á deleteFile með réttum slóð', async () => {
    const api = {
      readJson: vi.fn().mockResolvedValue({ data: {}, sha: 'sha-del' }),
      deleteFile: vi.fn().mockResolvedValue(undefined),
    };
    await deleteEquipmentTemplate(api as never, 'uuid-1');
    expect(api.deleteFile).toHaveBeenCalledWith(
      'data/equipment_templates/uuid-1.json',
      'sha-del',
      expect.any(String),
    );
  });
});
