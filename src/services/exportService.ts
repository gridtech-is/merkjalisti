// src/services/exportService.ts
import * as XLSX from 'xlsx';
import type { Bay, BaySignal, Equipment, ApparatusType, EquipmentCategory, SignalState, ZenonTagCategory } from '../types';

const APPARATUS_TYPES = ['Aflrofi', 'Skilrofi', 'Jarðrofi', 'Spennir', 'Stjórnbúnaður', 'Annað'];

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const APPARATUS_HEADERS = ['Kóði', 'Gerð', 'Lýsing'];
const IED_HEADERS = ['Tech key', 'IED nafn', 'Framleiðandi', 'Líkan', 'Lýsing'];

export function exportEquipmentTemplate(equipment: Equipment[], projectName: string): void {
  const wb = XLSX.utils.book_new();

  const wsG = XLSX.utils.aoa_to_sheet([
    ['Gerð', 'Lýsing'],
    ['Aflrofi', 'Circuit Breaker (CB)'],
    ['Skilrofi', 'Disconnector (DS)'],
    ['Jarðrofi', 'Earth Switch (ES)'],
    ['Spennir', 'Transformer (TR)'],
    ['Stjórnbúnaður', 'Control equipment'],
    ['Annað', 'Other'],
  ]);
  wsG['!cols'] = [{ wch: 18 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsG, 'Gerðir');
  const apparatus = equipment.filter(e => e.category === 'apparatus' || !e.category);
  const apparatusRows = apparatus.map(e => [e.code, e.type ?? '', e.description]);
  const wsA = XLSX.utils.aoa_to_sheet([APPARATUS_HEADERS, ...apparatusRows]);
  wsA['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 40 }];
  wsA['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, wsA, 'Búnaður');

  const ieds = equipment.filter(e => e.category === 'ied');
  const iedRows = ieds.map(e => [e.code, e.ied_name ?? '', e.manufacturer ?? '', e.model ?? '', e.description]);
  const wsI = XLSX.utils.aoa_to_sheet([IED_HEADERS, ...iedRows]);
  wsI['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 40 }];
  wsI['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, wsI, 'IED');

  XLSX.writeFile(wb, `${projectName}-tæki.xlsx`);
}

export function importEquipmentFromExcel(file: File): Promise<Equipment[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const result: Equipment[] = [];

        const wsA = wb.Sheets['Búnaður'];
        if (wsA) {
          const rows = XLSX.utils.sheet_to_json<string[]>(wsA, { header: 1, defval: '' }) as string[][];
          for (const row of rows.slice(1)) {
            const code = String(row[0] ?? '').trim().toUpperCase();
            if (!code) continue;
            const type = String(row[1] ?? '').trim();
            result.push({
              id: uuid(),
              category: 'apparatus' as EquipmentCategory,
              code,
              type: (APPARATUS_TYPES.includes(type) ? type : 'Annað') as ApparatusType,
              ied_name: null,
              manufacturer: null,
              model: null,
              config_version: null,
              template_id: null,
              description: String(row[2] ?? '').trim(),
            });
          }
        }

        const wsI = wb.Sheets['IED'];
        if (wsI) {
          const rows = XLSX.utils.sheet_to_json<string[]>(wsI, { header: 1, defval: '' }) as string[][];
          for (const row of rows.slice(1)) {
            const code = String(row[0] ?? '').trim().toUpperCase();
            if (!code) continue;
            result.push({
              id: uuid(),
              category: 'ied' as EquipmentCategory,
              code,
              type: null,
              ied_name: String(row[1] ?? '').trim() || null,
              manufacturer: String(row[2] ?? '').trim() || null,
              model: String(row[3] ?? '').trim() || null,
              config_version: null,
              template_id: null,
              description: String(row[4] ?? '').trim(),
            });
          }
        }

        resolve(result);
      } catch {
        reject(new Error('Gat ekki lesið Excel skrá'));
      }
    };
    reader.onerror = () => reject(new Error('Villa við lestur skrár'));
    reader.readAsArrayBuffer(file);
  });
}

const HEADERS = [
  'Kóði',              // display_id_equipment_signal
  'Reitur',            // bay.display_id
  'Tæki',              // equipment_code
  'Merki',             // signal_name
  'Heiti (IS)',        // name_is
  'Heiti (EN)',        // name_en
  'Uppspretta',        // source_type
  'Alarm',             // is_alarm
  'Flokkur',           // alarm_class
  'Fasi bætt við',     // phase_added
  'FAT prófað',        // fat_tested
  'FAT af',            // fat_tested_by
  'FAT dagsetning',    // fat_tested_at
  'SAT prófað',        // sat_tested
  'SAT af',            // sat_tested_by
  'SAT dagsetning',    // sat_tested_at
  'IEC IED',           // iec61850_ied
  'IEC LD',            // iec61850_ld
  'IEC LN',            // iec61850_ln
  'IEC LN Prefix',     // iec61850_ln_prefix
  'IEC LN Inst',       // iec61850_ln_inst
  'IEC doName',        // iec61850_do
  'IEC daName',        // iec61850_da
  'IEC FC',            // iec61850_fc
  'IEC CDC',           // iec61850_cdc
  'IEC Dataset',       // iec61850_dataset
  'IEC RCB',           // iec61850_rcb
  'IEC Dataset Entry', // iec61850_dataset_entry
];

function signalRow(bayDisplayId: string, sig: BaySignal): (string | number | boolean)[] {
  const code = [bayDisplayId, sig.equipment_code, sig.signal_name].filter(Boolean).join('_');
  return [
    code,
    bayDisplayId,
    sig.equipment_code,
    sig.signal_name,
    sig.name_is,
    sig.name_en ?? '',
    sig.source_type,
    sig.is_alarm,
    sig.alarm_class ?? '',
    sig.phase_added,
    sig.fat_tested,
    sig.fat_tested_by ?? '',
    sig.fat_tested_at ? new Date(sig.fat_tested_at).toLocaleDateString('is-IS') : '',
    sig.sat_tested,
    sig.sat_tested_by ?? '',
    sig.sat_tested_at ? new Date(sig.sat_tested_at).toLocaleDateString('is-IS') : '',
    sig.iec61850_ied ?? '',
    sig.iec61850_ld ?? '',
    sig.iec61850_ln ?? '',
    sig.iec61850_ln_prefix ?? '',
    sig.iec61850_ln_inst ?? '',
    sig.iec61850_do ?? '',
    sig.iec61850_da ?? '',
    sig.iec61850_fc ?? '',
    sig.iec61850_cdc ?? '',
    sig.iec61850_dataset ?? '',
    sig.iec61850_rcb ?? '',
    sig.iec61850_dataset_entry ?? '',
  ];
}

export function exportBayToExcel(bay: Bay): void {
  const rows = bay.signals.map(s => signalRow(bay.display_id, s));
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  ws['!cols'] = [
    20, 12, 10, 16, 36, 36, 12, 8, 8, 10,
    10, 14, 14, 10, 14, 14,
    14, 10, 10, 12, 10, 16, 6, 10, 16, 16, 18,
  ].map(w => ({ wch: w }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, bay.display_id.substring(0, 31));
  XLSX.writeFile(wb, `${bay.display_id}-merki.xlsx`);
}

export function exportAllBaysToExcel(bays: Bay[], projectName: string): void {
  const allRows = bays.flatMap(bay => bay.signals.map(s => signalRow(bay.display_id, s)));
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...allRows]);
  ws['!cols'] = [
    20, 12, 10, 16, 36, 36, 12, 8, 8, 10,
    10, 14, 14, 10, 14, 14,
    14, 10, 10, 12, 10, 16, 6, 10, 16, 16, 18,
  ].map(w => ({ wch: w }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Merki');
  XLSX.writeFile(wb, `${projectName}-merkjalisti.xlsx`);
}

// ─── zenon XML export ────────────────────────────────────────────────────────

interface ZenonTypeInfo {
  typeId: number;
  datatyp: number;
  name: string;
  signalMin: string;
  signalMax: string;
  rangeMin: string;
  rangeMax: string;
  valueMin: string;
  valueMax: string;
}

const BOOL_TYPE: ZenonTypeInfo = {
  typeId: 8, datatyp: 8, name: 'BOOL',
  signalMin: '0.0000000000', signalMax: '1.0000000000',
  rangeMin: '0.0000000000', rangeMax: '1.0000000000',
  valueMin: '0.0000000000', valueMax: '1.0000000000',
};
const UDINT_TYPE: ZenonTypeInfo = {
  typeId: 5, datatyp: 4, name: 'UDINT',
  signalMin: '0.0000000000', signalMax: '4294967295.0000000000',
  rangeMin: '0.0000000000', rangeMax: '4294967295.0000000000',
  valueMin: '0.0000000000', valueMax: '4294967295.0000000000',
};
const REAL_TYPE: ZenonTypeInfo = {
  typeId: 6, datatyp: 5, name: 'REAL',
  signalMin: '0.0000000000', signalMax: '100000.0000000000',
  rangeMin: '0.0000000000', rangeMax: '100000.0000000000',
  valueMin: '0.0000000000', valueMax: '100000.0000000000',
};
const DINT_TYPE: ZenonTypeInfo = {
  typeId: 4, datatyp: 3, name: 'DINT',
  signalMin: '0.0000000000', signalMax: '2147483647.0000000000',
  rangeMin: '0.0000000000', rangeMax: '2147483647.0000000000',
  valueMin: '0.0000000000', valueMax: '2147483647.0000000000',
};

const STRING_TYPE: ZenonTypeInfo = {
  typeId: 10, datatyp: 12, name: 'STRING',
  signalMin: '0.0000000000', signalMax: '0.0000000000',
  rangeMin: '0.0000000000', rangeMax: '0.0000000000',
  valueMin: '0.0000000000', valueMax: '0.0000000000',
};

const CDC_TYPE_INFO: Record<string, ZenonTypeInfo> = {
  SPS: BOOL_TYPE, ACT: BOOL_TYPE, ACD: BOOL_TYPE, SPC: BOOL_TYPE, DPC: BOOL_TYPE,
  DPS: UDINT_TYPE,
  MV: REAL_TYPE, CMV: REAL_TYPE, SAV: REAL_TYPE,
  INS: DINT_TYPE, INC: DINT_TYPE,
};
const LIMITS_FLAGS =
  '<FlagActiv>TRUE</FlagActiv><FlagAlarm>TRUE</FlagAlarm><FlagDelay>TRUE</FlagDelay>' +
  '<FlagAColor>TRUE</FlagAColor><FlagGroup>TRUE</FlagGroup><FlagClassID>TRUE</FlagClassID>' +
  '<FlagMessage>TRUE</FlagMessage><FlagIsAlarm>TRUE</FlagIsAlarm><FlagTreshold>TRUE</FlagTreshold>' +
  '<FlagToDelete>TRUE</FlagToDelete><FlagToCEL>TRUE</FlagToCEL><FlagInvisible>TRUE</FlagInvisible>' +
  '<FlagLimitIsMax>TRUE</FlagLimitIsMax><FlagLimitVar>TRUE</FlagLimitVar><FlagAQuit>TRUE</FlagAQuit>' +
  '<FlagBlinking>TRUE</FlagBlinking><FlagAlarmPrt>TRUE</FlagAlarmPrt><FlagFunction>TRUE</FlagFunction>' +
  '<FlagFunctionAML>TRUE</FlagFunctionAML><FlagFunctionETM>TRUE</FlagFunctionETM>' +
  '<FlagQuest>FALSE</FlagQuest><FlagLimitVariable>TRUE</FlagLimitVariable>' +
  '<FlagHelpFile>TRUE</FlagHelpFile><FlagHelpCapture>TRUE</FlagHelpCapture>' +
  '<FlagUser1>TRUE</FlagUser1><FlagUser2>TRUE</FlagUser2>' +
  '<FlagAComment>TRUE</FlagAComment><FlagACause>TRUE</FlagACause>';

const VAR_ISLOCAL =
  '<IsLocalPasswordlevel>TRUE</IsLocalPasswordlevel>' +
  '<IsLocalESignatureVerificationLevel>TRUE</IsLocalESignatureVerificationLevel>' +
  '<IsLocalESignatureApprobationLevel>TRUE</IsLocalESignatureApprobationLevel>' +
  '<IsLocalSignatureMode>TRUE</IsLocalSignatureMode>' +
  '<IsLocalSignatureText>FALSE</IsLocalSignatureText>' +
  '<IsLocalSignatureEditModus>TRUE</IsLocalSignatureEditModus>' +
  '<IsLocalESignatureCommentRequiredForPerform>TRUE</IsLocalESignatureCommentRequiredForPerform>' +
  '<IsLocalESignatureCommentRequiredForVerify>TRUE</IsLocalESignatureCommentRequiredForVerify>' +
  '<IsLocalESignatureCommentRequiredForApprove>TRUE</IsLocalESignatureCommentRequiredForApprove>' +
  '<IsLocalDigits>TRUE</IsLocalDigits><IsLocalSignalMin>TRUE</IsLocalSignalMin>' +
  '<IsLocalSignalMax>TRUE</IsLocalSignalMax><IsLocalRangeMin>TRUE</IsLocalRangeMin>' +
  '<IsLocalRangeMax>TRUE</IsLocalRangeMax><IsLocalAlternateValue>TRUE</IsLocalAlternateValue>' +
  '<IsLocalValueMin>TRUE</IsLocalValueMin><IsLocalValueMax>TRUE</IsLocalValueMax>' +
  '<IsLocalUseMacro>TRUE</IsLocalUseMacro><IsLocalInOut>TRUE</IsLocalInOut>' +
  '<IsLocalHystNeg>TRUE</IsLocalHystNeg><IsLocalHystPos>TRUE</IsLocalHystPos>' +
  '<IsLocalArchHystValueType>TRUE</IsLocalArchHystValueType>' +
  '<IsLocalArchHystNeg>TRUE</IsLocalArchHystNeg><IsLocalArchHystPos>TRUE</IsLocalArchHystPos>' +
  '<IsLocalArchHystRelativeMinus>TRUE</IsLocalArchHystRelativeMinus>' +
  '<IsLocalArchHystRelativePlus>TRUE</IsLocalArchHystRelativePlus>' +
  '<IsLocalUpdatePriority>TRUE</IsLocalUpdatePriority><IsLocalDDEaktiv>TRUE</IsLocalDDEaktiv>' +
  '<IsLocalStandby>TRUE</IsLocalStandby><IsLocalRemaActiv>TRUE</IsLocalRemaActiv>' +
  '<IsLocalRema>TRUE</IsLocalRema><IsLocalHDActive>TRUE</IsLocalHDActive>' +
  '<IsLocalHDUpdate>TRUE</IsLocalHDUpdate><IsLocalHDSize>TRUE</IsLocalHDSize>' +
  '<IsLocalKDAActiv>TRUE</IsLocalKDAActiv><IsLocalStingLength>TRUE</IsLocalStingLength>' +
  '<IsLocalQuitPV>FALSE</IsLocalQuitPV><IsLocalViewQuitPV>FALSE</IsLocalViewQuitPV>' +
  '<IsLocalQuitValue>TRUE</IsLocalQuitValue><IsLocalTagname>TRUE</IsLocalTagname>' +
  '<IsLocalUnit>FALSE</IsLocalUnit><IsLocalAltValString>FALSE</IsLocalAltValString>' +
  '<IsLocalRecLabel>TRUE</IsLocalRecLabel><IsLocalAdjustHW>FALSE</IsLocalAdjustHW>' +
  '<IsLocalAdjustZenon>FALSE</IsLocalAdjustZenon><IsLocalArraySize>TRUE</IsLocalArraySize>' +
  '<IsLocalCounterGroup>TRUE</IsLocalCounterGroup><IsLocalMaxGradient>TRUE</IsLocalMaxGradient>' +
  '<IsLocalNormalStateActive>TRUE</IsLocalNormalStateActive>' +
  '<IsLocalNormalState>TRUE</IsLocalNormalState>' +
  '<IsLocalAlarmPV0>FALSE</IsLocalAlarmPV0><IsLocalAlarmPV1>FALSE</IsLocalAlarmPV1>' +
  '<IsLocalAlarmPV2>FALSE</IsLocalAlarmPV2><IsLocalVarInASM>TRUE</IsLocalVarInASM>' +
  '<IsLocalAlarmDomain>TRUE</IsLocalAlarmDomain><IsLocalAlarmDomain2>FALSE</IsLocalAlarmDomain2>' +
  '<IsLocalAlarmDomain3>FALSE</IsLocalAlarmDomain3><IsLocalAlarmDomain4>FALSE</IsLocalAlarmDomain4>' +
  '<IsLocalLocking>FALSE</IsLocalLocking><IsLocalSBO>TRUE</IsLocalSBO>' +
  '<IsLocalCancelOperate>TRUE</IsLocalCancelOperate>' +
  '<IsLocalAlarmViaEquipmentModel>TRUE</IsLocalAlarmViaEquipmentModel>' +
  '<IsLocalUsedInProcRec>TRUE</IsLocalUsedInProcRec><IsLocalStyleUsed>FALSE</IsLocalStyleUsed>' +
  '<IsLocalZeroClamping>TRUE</IsLocalZeroClamping>' +
  '<IsLocalTimestampDeviation>TRUE</IsLocalTimestampDeviation>' +
  '<IsLocalSwingingDoorAlgorithmToleranceType>TRUE</IsLocalSwingingDoorAlgorithmToleranceType>' +
  '<IsLocalSwingingDoorAlgorithmTolerance>TRUE</IsLocalSwingingDoorAlgorithmTolerance>' +
  '<IsLocalSwingingDoorAlgorithmRelativeTolerance>TRUE</IsLocalSwingingDoorAlgorithmRelativeTolerance>';

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeVarName(bayName: string, code: string, name: string): string {
  return `${bayName}_${code}_${name}`
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function zenonTagCategory(
  sig: BaySignal,
  apparatusTypeMap: Record<string, ApparatusType> = {},
): string {
  const ln = (sig.iec61850_ln ?? '').toUpperCase();
  const cdc = (sig.iec61850_cdc ?? '').toUpperCase();

  if (ln.startsWith('XCBR')) return 'CIRCUIT BREAKER';

  if (ln.startsWith('XSWI')) {
    return apparatusTypeMap[sig.equipment_code] === 'Jarðrofi' ? 'EARTHING SWITCH' : 'DISCONNECTOR';
  }

  if (cdc === 'MV' || cdc === 'CMV' || cdc === 'SAV' || cdc === 'INS' || cdc === 'INC') {
    return 'MEASUREMENT';
  }

  if (ln.startsWith('MMXU') || ln.startsWith('MMTR') || ln.startsWith('MSQI') || ln.startsWith('MMTN')) {
    return 'MEASUREMENT';
  }

  if (ln.startsWith('LCCH')) return 'NETWORK';

  if (sig.iec61850_do?.toUpperCase() === 'LOC') return 'LOCAL/REMOTE';

  if (/^P[A-Z]/.test(ln) || ln.startsWith('LGOS') || ln.startsWith('LSVS') ||
      ln.startsWith('RBRF') || ln.startsWith('RREC') || ln.startsWith('RDRE') || ln.startsWith('RDIR')) {
    return 'PROTECTION';
  }

  return 'PROTECTION';
}

function buildSymbAddr(sig: BaySignal): string {
  const prefix = sig.iec61850_ln_prefix ?? '';
  const inst = sig.iec61850_ln_inst ?? '';
  const daPart = sig.iec61850_da ? `/${sig.iec61850_da}` : '';
  const fcPart = sig.iec61850_fc ? `[${sig.iec61850_fc}]` : '';
  return `Server_${sig.iec61850_ied}!${sig.iec61850_ld}/${prefix}${sig.iec61850_ln}${inst}/${sig.iec61850_do}${daPart}${fcPart}`;
}

function limitsBaseContent(
  text: string, limitValue: string, isMax: boolean, color: string,
  alarm: boolean, cel: boolean, className: string,
): string {
  const textEl = text ? `<Text>${xmlEscape(text)}</Text>` : '<Text/>';
  const classEl = className ? `<ClassName>${xmlEscape(className)}</ClassName>` : '<ClassName/>';
  return (
    `<Active>TRUE</Active>${textEl}` +
    `<LimitValue>${limitValue}</LimitValue>` +
    `<IsMax>${isMax ? 'TRUE' : 'FALSE'}</IsMax>` +
    `<ThresholdValue>0.0000000000</ThresholdValue><Delay>0</Delay>` +
    `<IsVariable>FALSE</IsVariable><Variable/><Function/><FunctionAML/><FunctionETM/>` +
    `<Color>${color}</Color><Invisible>FALSE</Invisible><Blinking>FALSE</Blinking>` +
    `<UserProperty1/><UserProperty2/>` +
    `<Alarm>${alarm ? 'TRUE' : 'FALSE'}</Alarm>` +
    `<Cel>${cel ? 'TRUE' : 'FALSE'}</Cel>` +
    `<AlarmAcknowledge>TRUE</AlarmAcknowledge><AlarmComment>FALSE</AlarmComment>` +
    `<AlarmCause>FALSE</AlarmCause><AlarmDelete>FALSE</AlarmDelete><Print>FALSE</Print>` +
    `<GroupName/>${classEl}<HelpFile/><HelpCapture/>`
  );
}

function varLimitsBlock(
  n: number, text: string, limitValue: string, isMax: boolean,
  color: string, alarm: boolean, cel: boolean, className: string,
): string {
  return `<Limits_${n} NODE="zenOn(R) embedded object">${limitsBaseContent(text, limitValue, isMax, color, alarm, cel, className)}${LIMITS_FLAGS}</Limits_${n}>`;
}

function typeLimitsBlock(n: number, limitValue: string, isMax: boolean, color: string): string {
  return `<Limits_${n} NODE="zenOn(R) embedded object">${limitsBaseContent('', limitValue, isMax, color, false, false, '')}</Limits_${n}>`;
}

function variableXml(
  sig: BaySignal,
  typeInfo: ZenonTypeInfo,
  bayName: string,
  netAddrMap: Record<string, number> = {},
  apparatusTypeMap: Record<string, ApparatusType> = {},
): string {
  const name = safeVarName(bayName, sig.equipment_code, sig.signal_name);
  const symbAddr = buildSymbAddr(sig);
  const matrixVal = sig.state_id ? xmlEscape(sig.state_id) : '';
  const isBool = typeInfo.typeId === BOOL_TYPE.typeId;
  const cat = sig.group_label?.trim() || zenonTagCategory(sig, apparatusTypeMap);
  const tagname = `${bayName} @${cat}`;
  const hasAlarm = sig.is_alarm && sig.alarm_class != null;
  const className = hasAlarm ? String(sig.alarm_class) : '';

  const limitsBlocks = isBool
    ? varLimitsBlock(0, '', '0.0000000000', false, 'FF0000', false, false, '') +
      varLimitsBlock(1, `@${sig.signal_name}`, '1.0000000000', true, '80000012', sig.is_alarm, sig.is_alarm, className)
    : '';

  return (
    `<Variable ShortName="${xmlEscape(name)}" DriverID="4" TypeID="${typeInfo.typeId}" ` +
    `HWObjectType="8" HWObjectName="PLC marker" IsComplex="FALSE" Matrix="${matrixVal}">` +
    limitsBlocks +
    `<ID_ComplexVariable>0</ID_ComplexVariable>` +
    `<Name>${xmlEscape(name)}</Name>` +
    `<Tagname>${xmlEscape(tagname)}</Tagname>` +
    `<ExternalReference/><Description/><SOSourceName/><SystemModelGroup/>` +
    `<AlternateValue>0.0000000000</AlternateValue>` +
    `<Recourceslabel>@${xmlEscape(sig.signal_name)}</Recourceslabel>` +
    `<NetAddr>${netAddrMap[sig.iec61850_ied ?? ''] ?? 0}</NetAddr><DataBlock>0</DataBlock><Offset>0</Offset>` +
    `<BitAddr>0</BitAddr><Alignment>0</Alignment><StringLength>5</StringLength>` +
    `<SymbAddr>${xmlEscape(symbAddr)}</SymbAddr>` +
    `<ID_DriverTyp>8</ID_DriverTyp>` +
    `<UpdatePriority>0</UpdatePriority><Standby>FALSE</Standby><Digits>0</Digits>` +
    `<SignalMin>${typeInfo.signalMin}</SignalMin><SignalMax>${typeInfo.signalMax}</SignalMax>` +
    `<RangeMin>${typeInfo.rangeMin}</RangeMin><RangeMax>${typeInfo.rangeMax}</RangeMax>` +
    `<UseMacro>FALSE</UseMacro>` +
    `<HystNeg>0.0000000000</HystNeg><HystPos>0.0000000000</HystPos>` +
    `<ArchHystValueType>0</ArchHystValueType>` +
    `<ArchHystNeg>0.0000000000</ArchHystNeg><ArchHystPos>0.0000000000</ArchHystPos>` +
    `<ArchHystRelativeMinus>0.0000000000</ArchHystRelativeMinus>` +
    `<ArchHystRelativePlus>0.0000000000</ArchHystRelativePlus>` +
    `<SwingingDoorAlgorithmToleranceType>0</SwingingDoorAlgorithmToleranceType>` +
    `<SwingingDoorAlgorithmTolerance>0.0000000000</SwingingDoorAlgorithmTolerance>` +
    `<SwingingDoorAlgorithmRelativeTolerance>0.0000000000</SwingingDoorAlgorithmRelativeTolerance>` +
    `<ZeroClamping>0.0000000000</ZeroClamping><TimestampDeviation>0.0000000000</TimestampDeviation>` +
    `<DDEActive>FALSE</DDEActive><ArraySizeOld>1</ArraySizeOld>` +
    `<CounterGroup>0</CounterGroup><MaxGradient>0</MaxGradient>` +
    `<NormalStateActive>FALSE</NormalStateActive><NormalState>FALSE</NormalState>` +
    `<HDActive>FALSE</HDActive><HDUpdate>1.000000</HDUpdate><HDSize>0</HDSize>` +
    `<IsKDAActiv>FALSE</IsKDAActiv>` +
    `<ExternVisible>FALSE</ExternVisible><ExternVisibleFor/>` +
    `<ReadWrite>TRUE</ReadWrite><InitialValue/><Profilename/><Adressparam/><Vargroup/>` +
    `<ServiceGridAccessPermission>0</ServiceGridAccessPermission>` +
    `<IsRemaActiv>${sig.state_id ? 'TRUE' : 'FALSE'}</IsRemaActiv>` +
    `<AlarmQuitPVValue>0</AlarmQuitPVValue>` +
    `<VarInASM>FALSE</VarInASM><AlarmViaEquipmentModel>FALSE</AlarmViaEquipmentModel>` +
    `<AreaName>Alarm_Area_Status</AreaName>` +
    `<Passwordlevel>0</Passwordlevel>` +
    `<eSignatureCommentRequiredForPerform>TRUE</eSignatureCommentRequiredForPerform>` +
    `<SignatureMode>0</SignatureMode>` +
    `<eSignatureVerificationLevel>0</eSignatureVerificationLevel>` +
    `<eSignatureCommentRequiredForVerify>TRUE</eSignatureCommentRequiredForVerify>` +
    `<eSignatureApprobationLevel>0</eSignatureApprobationLevel>` +
    `<eSignatureCommentRequiredForApprove>TRUE</eSignatureCommentRequiredForApprove>` +
    `<SignatureEditModus>0</SignatureEditModus>` +
    `<InOut>TRUE</InOut><SBO>FALSE</SBO><CancelOperate>FALSE</CancelOperate>` +
    `<ValueMin>${typeInfo.valueMin}</ValueMin><ValueMax>${typeInfo.valueMax}</ValueMax>` +
    `<LockingName/><SetValueProtocol>1</SetValueProtocol>` +
    `<SV_Act>FALSE</SV_Act><SV_VBA>TRUE</SV_VBA>` +
    `<VisualName/><Meaning/><WaterfallParam/><Use_in_ProcRec>FALSE</Use_in_ProcRec>` +
    VAR_ISLOCAL +
    `<IsSWProtokol>1</IsSWProtokol><IsSW_Akt>TRUE</IsSW_Akt><IsSW_VBA>TRUE</IsSW_VBA>` +
    `</Variable>`
  );
}

function typeXml(typeInfo: ZenonTypeInfo): string {
  const isBool = typeInfo.typeId === BOOL_TYPE.typeId;
  const limitsBlocks = isBool
    ? typeLimitsBlock(0, '0.0000000000', false, 'FF0000') +
      typeLimitsBlock(1, '1.0000000000', true, '00FF00')
    : '';
  return (
    `<Type TypeID="${typeInfo.typeId}" IsComplex="FALSE">` +
    limitsBlocks +
    `<Invisible>FALSE</Invisible><Hidden>FALSE</Hidden>` +
    `<InternalTyp>TRUE</InternalTyp><ComplexTyp>FALSE</ComplexTyp>` +
    `<Datatyp>${typeInfo.datatyp}</Datatyp>` +
    `<Name>${typeInfo.name}</Name>` +
    `<Tagname/><Description>Einfacher Datentyp</Description>` +
    `<Unit/><ExternalReference/><SOSourceName/>` +
    `<AlternateValue>0.0000000000</AlternateValue>` +
    `<AlternateValueString/><Recourceslabel/><SystemModelGroup/>` +
    `<StyleGroup/><ScaleStyle/><CurveStyle/>` +
    `<IsRemaActiv>FALSE</IsRemaActiv>` +
    `<AlarmQuitPV/><AlarmViewQuitPV/><AlarmQuitPVValue>0</AlarmQuitPVValue>` +
    `<VarInASM>FALSE</VarInASM><AlarmViaEquipmentModel>FALSE</AlarmViaEquipmentModel>` +
    `<AreaName/><AreaName2/><AreaName3/><AreaName4/>` +
    `<Digits>0</Digits>` +
    `<HystNeg>0.0000000000</HystNeg><HystPos>0.0000000000</HystPos>` +
    `<ArchHystValueType>0</ArchHystValueType>` +
    `<ArchHystNeg>0.0000000000</ArchHystNeg><ArchHystPos>0.0000000000</ArchHystPos>` +
    `<ArchHystRelativeMinus>0.0000000000</ArchHystRelativeMinus>` +
    `<ArchHystRelativePlus>0.0000000000</ArchHystRelativePlus>` +
    `<SwingingDoorAlgorithmToleranceType>0</SwingingDoorAlgorithmToleranceType>` +
    `<SwingingDoorAlgorithmTolerance>0.0000000000</SwingingDoorAlgorithmTolerance>` +
    `<SwingingDoorAlgorithmRelativeTolerance>0.0000000000</SwingingDoorAlgorithmRelativeTolerance>` +
    `<ZeroClamping>0.0000000000</ZeroClamping><TimestampDeviation>0.0000000000</TimestampDeviation>` +
    `<SignalMin>${typeInfo.signalMin}</SignalMin><SignalMax>${typeInfo.signalMax}</SignalMax>` +
    `<RangeMin>${typeInfo.rangeMin}</RangeMin><RangeMax>${typeInfo.rangeMax}</RangeMax>` +
    `<UseMacro>FALSE</UseMacro><AdjustHardware/><AdjustZenon/>` +
    `<DDEActive>FALSE</DDEActive><ArraySizeOld>1</ArraySizeOld>` +
    `<CounterGroup>0</CounterGroup><MaxGradient>0</MaxGradient>` +
    `<NormalStateActive>FALSE</NormalStateActive><NormalState>FALSE</NormalState>` +
    `<AlarmPV0/><AlarmPV1/><AlarmPV2/>` +
    `<HDActive>FALSE</HDActive><HDUpdate>1.000000</HDUpdate><HDSize>0</HDSize>` +
    `<IsKDAActiv>FALSE</IsKDAActiv>` +
    `<Passwordlevel>0</Passwordlevel>` +
    `<eSignatureCommentRequiredForPerform>TRUE</eSignatureCommentRequiredForPerform>` +
    `<SignatureMode>0</SignatureMode>` +
    `<eSignatureVerificationLevel>0</eSignatureVerificationLevel>` +
    `<eSignatureCommentRequiredForVerify>TRUE</eSignatureCommentRequiredForVerify>` +
    `<eSignatureApprobationLevel>0</eSignatureApprobationLevel>` +
    `<eSignatureCommentRequiredForApprove>TRUE</eSignatureCommentRequiredForApprove>` +
    `<SignatureText/><SignatureEditModus>0</SignatureEditModus>` +
    `<InOut>TRUE</InOut><SBO>FALSE</SBO><CancelOperate>FALSE</CancelOperate>` +
    `<ValueMin>${typeInfo.valueMin}</ValueMin><ValueMax>${typeInfo.valueMax}</ValueMax>` +
    `<LockingName/><SetValueProtocol>1</SetValueProtocol>` +
    `<SV_Act>FALSE</SV_Act><SV_VBA>TRUE</SV_VBA>` +
    `<MaxStringLen>5</MaxStringLen>` +
    `<UpdatePriority>0</UpdatePriority><Standby>FALSE</Standby>` +
    `<Used_in_ProcRec>FALSE</Used_in_ProcRec>` +
    `</Type>`
  );
}

function toUtf16Le(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(2 + str.length * 2);
  const view = new DataView(buf);
  view.setUint16(0, 0xFEFF, true);
  for (let i = 0; i < str.length; i++) {
    view.setUint16(2 + i * 2, str.charCodeAt(i), true);
  }
  return buf;
}

function downloadXml(filename: string, content: string): void {
  const blob = new Blob([toUtf16Le(content)], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function bayNameVariableXml(bayName: string): string {
  const name = `${bayName}_Name`;
  const tagname = `-- ${bayName} --`;
  return (
    `<Variable ShortName="${xmlEscape(name)}" DriverID="1" TypeID="10" ` +
    `HWObjectType="33" HWObjectName="Internal variable" IsComplex="FALSE" Matrix="">` +
    `<ID_ComplexVariable>0</ID_ComplexVariable>` +
    `<Name>${xmlEscape(name)}</Name>` +
    `<Tagname>${xmlEscape(tagname)}</Tagname>` +
    `<ExternalReference/><Description/><SOSourceName/><SystemModelGroup/>` +
    `<AlternateValue>0.0000000000</AlternateValue>` +
    `<NetAddr>0</NetAddr><DataBlock>0</DataBlock><Offset>0</Offset>` +
    `<BitAddr>0</BitAddr><Alignment>0</Alignment><StringLength>5</StringLength>` +
    `<SymbAddr/>` +
    `<ID_DriverTyp>33</ID_DriverTyp>` +
    `<UpdatePriority>0</UpdatePriority><Standby>FALSE</Standby><Digits>0</Digits>` +
    `<SignalMin>0.0000000000</SignalMin><SignalMax>0.0000000000</SignalMax>` +
    `<RangeMin>0.0000000000</RangeMin><RangeMax>0.0000000000</RangeMax>` +
    `<UseMacro>FALSE</UseMacro>` +
    `<HystNeg>0.0000000000</HystNeg><HystPos>0.0000000000</HystPos>` +
    `<ArchHystValueType>0</ArchHystValueType>` +
    `<ArchHystNeg>0.0000000000</ArchHystNeg><ArchHystPos>0.0000000000</ArchHystPos>` +
    `<ArchHystRelativeMinus>0.0000000000</ArchHystRelativeMinus>` +
    `<ArchHystRelativePlus>0.0000000000</ArchHystRelativePlus>` +
    `<SwingingDoorAlgorithmToleranceType>0</SwingingDoorAlgorithmToleranceType>` +
    `<SwingingDoorAlgorithmTolerance>0.0000000000</SwingingDoorAlgorithmTolerance>` +
    `<SwingingDoorAlgorithmRelativeTolerance>0.0000000000</SwingingDoorAlgorithmRelativeTolerance>` +
    `<ZeroClamping>0.0000000000</ZeroClamping><TimestampDeviation>0.0000000000</TimestampDeviation>` +
    `<DDEActive>FALSE</DDEActive><ArraySizeOld>1</ArraySizeOld>` +
    `<CounterGroup>0</CounterGroup><MaxGradient>0</MaxGradient>` +
    `<NormalStateActive>FALSE</NormalStateActive><NormalState>FALSE</NormalState>` +
    `<HDActive>FALSE</HDActive><HDUpdate>1.000000</HDUpdate><HDSize>0</HDSize>` +
    `<IsKDAActiv>FALSE</IsKDAActiv>` +
    `<ExternVisible>FALSE</ExternVisible><ExternVisibleFor/>` +
    `<ReadWrite>TRUE</ReadWrite><InitialValue/><Profilename/><Adressparam/><Vargroup/>` +
    `<ServiceGridAccessPermission>0</ServiceGridAccessPermission>` +
    `<IsRemaActiv>FALSE</IsRemaActiv><AlarmQuitPVValue>0</AlarmQuitPVValue>` +
    `<VarInASM>FALSE</VarInASM><AlarmViaEquipmentModel>FALSE</AlarmViaEquipmentModel>` +
    `<AreaName>Alarm_Area_Status</AreaName><Passwordlevel>0</Passwordlevel>` +
    `<eSignatureCommentRequiredForPerform>TRUE</eSignatureCommentRequiredForPerform>` +
    `<SignatureMode>0</SignatureMode><eSignatureVerificationLevel>0</eSignatureVerificationLevel>` +
    `<eSignatureCommentRequiredForVerify>TRUE</eSignatureCommentRequiredForVerify>` +
    `<eSignatureApprobationLevel>0</eSignatureApprobationLevel>` +
    `<eSignatureCommentRequiredForApprove>TRUE</eSignatureCommentRequiredForApprove>` +
    `<SignatureEditModus>0</SignatureEditModus>` +
    `<InOut>TRUE</InOut><SBO>FALSE</SBO><CancelOperate>FALSE</CancelOperate>` +
    `<ValueMin>0.0000000000</ValueMin><ValueMax>0.0000000000</ValueMax>` +
    `<LockingName/><SetValueProtocol>1</SetValueProtocol>` +
    `<SV_Act>FALSE</SV_Act><SV_VBA>TRUE</SV_VBA>` +
    `<VisualName/><Meaning/><WaterfallParam/><Use_in_ProcRec>FALSE</Use_in_ProcRec>` +
    VAR_ISLOCAL +
    `<IsSWProtokol>1</IsSWProtokol><IsSW_Akt>TRUE</IsSW_Akt><IsSW_VBA>TRUE</IsSW_VBA>` +
    `<Local>TRUE</Local><Remanenz>0</Remanenz><Initial_value/>` +
    `</Variable>`
  );
}

const ALL_ZENON_TYPES = [BOOL_TYPE, UDINT_TYPE, REAL_TYPE, DINT_TYPE];

export function exportZenonXml(
  signals: BaySignal[],
  _signalStates: SignalState[],
  driverName: string,
  bayName: string,
  netAddrMap: Record<string, number> = {},
  apparatusTypeMap: Record<string, ApparatusType> = {},
): string {
  const eligible = signals.filter(
    s => s.iec61850_ied && s.iec61850_ld && s.iec61850_ln && s.iec61850_do,
  );

  const usedTypeIds = new Set<number>();
  const varXmls: string[] = [bayNameVariableXml(bayName)];

  for (const sig of eligible) {
    const cdc = sig.iec61850_cdc ?? '';
    const typeInfo = CDC_TYPE_INFO[cdc] ?? BOOL_TYPE;
    usedTypeIds.add(typeInfo.typeId);
    varXmls.push(variableXml(sig, typeInfo, bayName, netAddrMap, apparatusTypeMap));
  }

  const typeXmls = [
    typeXml(STRING_TYPE),
    ...ALL_ZENON_TYPES.filter(t => usedTypeIds.has(t.typeId)).map(t => typeXml(t)),
  ];

  return [
    '<?xml version="1.0" encoding="utf-16"?>',
    '<Subject ShortName="zenOn(R) exported project" MainVersion="15000">',
    '<Apartment ShortName="zenOn(R) process variables list" Version="15000">',
    ...varXmls,
    '</Apartment>',
    '<Apartment ShortName="zenOn(R) driver list" Version="15000">',
    '<Driver DriverID="1"><Name>Driver for internal variables</Name><Modul>Intern</Modul></Driver>',
    `<Driver DriverID="4"><Name>IEC 61850 driver</Name><Modul>${xmlEscape(driverName)}</Modul></Driver>`,
    '</Apartment>',
    '<Apartment ShortName="zenOn(R) type list" Version="15000">',
    ...typeXmls,
    '</Apartment>',
    '</Subject>',
  ].join('\n');
}

const SP_KEYS = ['00', '01'] as const;
const DP_KEYS = ['00', '01', '10', '11'] as const;
// zenon DPI order: OPEN, CLOSED, INTERMEDIATE, FAULT
const DP_STATE_ORDER = ['01', '10', '00', '11'] as const;
const DP_NORMAL_KEYS = new Set(['01', '10']);

function spiStateBlock(
  n: number, text: string, status: number, reaWert: number, reaMask: number, klasse: number,
): string {
  const textEl = text ? `<Text>${xmlEscape(text)}</Text>` : '<Text/>';
  return [
    `      <State_${n} NODE="zenOn(R) embedded object" TYPE="1">`,
    `        ${textEl}<Status>${status}</Status><GruppeIdx>0</GruppeIdx><KlasseIdx>${klasse}</KlasseIdx>`,
    `        <Function/><FunctionAML/><FunctionETM/><Color>0</Color><DelayTime>0</DelayTime>`,
    `        <UserProperty1/><UserProperty2/><HelpFile/><HelpTopic/><CheckArt>0</CheckArt>`,
    `        <ReaAlarm>0.0000000000</ReaAlarm><ReaWert>${reaWert}</ReaWert><ReaWertMaske>${reaMask}</ReaWertMaske>`,
    `        <ReaWertFlanke>0</ReaWertFlanke><ReaStatusStd>0</ReaStatusStd><ReaStatusExt>0</ReaStatusExt>`,
    `        <ReaStatusMaskeStd>0</ReaStatusMaskeStd><ReaStatusMaskeExt>0</ReaStatusMaskeExt>`,
    `        <ReaStatusFlankeStd>0</ReaStatusFlankeStd><ReaStatusFlankeExt>0</ReaStatusFlankeExt>`,
    `        <ReaAlarmBis>0.0000000000</ReaAlarmBis><AllValues>0</AllValues><Counter>0</Counter>`,
    `        <Hysterese>0.0000000000</Hysterese><Wildcards>FALSE</Wildcards><CaseSensitive>FALSE</CaseSensitive>`,
    `        <ReaStringValue/>`,
    `      </State_${n}>`,
  ].join('\n');
}

function dpiStateBlock(
  n: number, text: string, status: number, reAlarmIdx: number, klasse: number,
): string {
  const textEl = text ? `<Text>${xmlEscape(text)}</Text>` : '<Text/>';
  return [
    `      <State_${n} NODE="zenOn(R) embedded object" TYPE="1">`,
    `        ${textEl}<Status>${status}</Status><GruppeIdx>0</GruppeIdx><KlasseIdx>${klasse}</KlasseIdx>`,
    `        <Function/><FunctionAML/><FunctionETM/><Color>2147483777</Color><DelayTime>0</DelayTime>`,
    `        <UserProperty1/><UserProperty2/><HelpFile/><HelpTopic/><CheckArt>3</CheckArt>`,
    `        <ReaAlarm>${reAlarmIdx}.0000000000</ReaAlarm><ReaWert>0</ReaWert><ReaWertMaske>0</ReaWertMaske>`,
    `        <ReaWertFlanke>0</ReaWertFlanke><ReaStatusStd>0</ReaStatusStd><ReaStatusExt>0</ReaStatusExt>`,
    `        <ReaStatusMaskeStd>0</ReaStatusMaskeStd><ReaStatusMaskeExt>0</ReaStatusMaskeExt>`,
    `        <ReaStatusFlankeStd>0</ReaStatusFlankeStd><ReaStatusFlankeExt>0</ReaStatusFlankeExt>`,
    `        <ReaAlarmBis>0.0000000000</ReaAlarmBis><AllValues>0</AllValues><Counter>0</Counter>`,
    `        <Hysterese>0.0000000000</Hysterese><Wildcards>FALSE</Wildcards><CaseSensitive>FALSE</CaseSensitive>`,
    `        <ReaStringValue/>`,
    `      </State_${n}>`,
  ].join('\n');
}

export function exportZenonReactionMatrix(
  signals: BaySignal[],
  signalStates: SignalState[],
): string {
  const referencedIds = [...new Set(
    signals.map(s => s.state_id).filter((id): id is string => id != null),
  )];

  const alarmIndex = new Map<string, Map<string, number>>();
  for (const stateId of referencedIds) {
    const keyMap = new Map<string, number>();
    for (const sig of signals.filter(s => s.state_id === stateId)) {
      for (const key of DP_KEYS) {
        const perState = sig.state_alarm_map?.[key];
        let klasse = keyMap.get(key) ?? 0;
        if (perState?.is_alarm && perState.alarm_class != null) {
          klasse = Math.max(klasse, perState.alarm_class);
        } else if (!sig.state_alarm_map && sig.is_alarm && sig.alarm_class != null && key !== '00') {
          klasse = Math.max(klasse, sig.alarm_class);
        }
        keyMap.set(key, klasse);
      }
    }
    alarmIndex.set(stateId, keyMap);
  }

  const stateIndex = new Map(signalStates.map(s => [s.id, s]));

  const lines: string[] = [
    '<?xml version="1.0" encoding="utf-16"?>',
    '<Subject ShortName="zenOn(R) exported project" MainVersion="15000">',
    '  <Apartment ShortName="zenOn(R) reaction matrix list" Version="15000">',
  ];

  for (const stateId of referencedIds) {
    const stateDef = stateIndex.get(stateId);
    if (!stateDef) continue;

    const isDP = Object.keys(stateDef.states).some(k => k === '10' || k === '11');
    const aMap = alarmIndex.get(stateId)!;
    const rematrixTypeId = isDP ? 2 : 1;

    lines.push(`    <Rematrix ShortName="${xmlEscape(stateId)}" TypeID="${rematrixTypeId}">`);

    if (isDP) {
      lines.push(spiStateBlock(0, '', 640, 0, 0, 0));
      DP_STATE_ORDER.forEach((key, idx) => {
        const entry = stateDef.states[key];
        const text = entry?.key ? `@${entry.key}` : key;
        const klasse = aMap.get(key) ?? 0;
        const isNormal = DP_NORMAL_KEYS.has(key);
        const status = !isNormal || klasse > 0 ? 641 : 640;
        lines.push(dpiStateBlock(idx + 1, text, status, idx, klasse));
      });
    } else {
      lines.push(spiStateBlock(0, '', 0, 0, 0, 0));
      SP_KEYS.forEach((key, idx) => {
        const entry = stateDef.states[key];
        const text = entry?.key ? `@${entry.key}` : key;
        const reaWert = parseInt(key, 2);
        const klasse = aMap.get(key) ?? 0;
        const status = klasse > 0 ? 513 : 512;
        lines.push(spiStateBlock(idx + 1, text, status, reaWert, 1, klasse));
      });
    }

    lines.push(`      <Name>${xmlEscape(stateId)}</Name>`);
    lines.push(`      <Description/><Type>${rematrixTypeId}</Type>`);
    lines.push('      <ExternalReference/><SOSourceName/><SystemModelGroup/>');
    lines.push('    </Rematrix>');
  }

  lines.push('  </Apartment>');
  lines.push('</Subject>');
  return lines.join('\n');
}


export function exportZenonAllBaysVariables(
  bays: Bay[],
  projectName: string,
  _signalStates: SignalState[],
  driverName = 'IEC850',
  netAddrMap: Record<string, number> = {},
  apparatusTypeMap: Record<string, ApparatusType> = {},
): void {
  const allVarXmls: string[] = [];
  const allUsedTypeIds = new Set<number>();

  bays.forEach(bay => {
    allVarXmls.push(bayNameVariableXml(bay.display_id));
    const eligible = bay.signals.filter(
      s => s.iec61850_ied && s.iec61850_ld && s.iec61850_ln && s.iec61850_do,
    );
    for (const sig of eligible) {
      const cdc = sig.iec61850_cdc ?? '';
      const typeInfo = CDC_TYPE_INFO[cdc] ?? BOOL_TYPE;
      allUsedTypeIds.add(typeInfo.typeId);
      allVarXmls.push(variableXml(sig, typeInfo, bay.display_id, netAddrMap, apparatusTypeMap));
    }
  });

  const typeXmls = [
    typeXml(STRING_TYPE),
    ...ALL_ZENON_TYPES.filter(t => allUsedTypeIds.has(t.typeId)).map(t => typeXml(t)),
  ];

  const xml = [
    '<?xml version="1.0" encoding="utf-16"?>',
    '<Subject ShortName="zenOn(R) exported project" MainVersion="15000">',
    '<Apartment ShortName="zenOn(R) process variables list" Version="15000">',
    ...allVarXmls,
    '</Apartment>',
    '<Apartment ShortName="zenOn(R) driver list" Version="15000">',
    '<Driver DriverID="1"><Name>Driver for internal variables</Name><Modul>Intern</Modul></Driver>',
    `<Driver DriverID="4"><Name>IEC 61850 driver</Name><Modul>${xmlEscape(driverName)}</Modul></Driver>`,
    '</Apartment>',
    '<Apartment ShortName="zenOn(R) type list" Version="15000">',
    ...typeXmls,
    '</Apartment>',
    '</Subject>',
  ].join('\n');

  downloadXml(`${projectName}-zenon-variables.xml`, xml);
}

export function exportZenonAllBaysRematrix(bays: Bay[], projectName: string, signalStates: SignalState[]): void {
  const all = bays.flatMap(b => b.signals);
  downloadXml(`${projectName}-zenon-rematrix.xml`, exportZenonReactionMatrix(all, signalStates));
}

export function exportZenonAllBays(bays: Bay[], projectName: string, signalStates: SignalState[], driverName = 'IEC850'): void {
  exportZenonAllBaysVariables(bays, projectName, signalStates, driverName);
  exportZenonAllBaysRematrix(bays, projectName, signalStates);
}

// ─── zenon Language.csv merge ────────────────────────────────────────────────

function parseLanguageCsvKeywords(csvText: string): Set<string> {
  const lines = csvText.split('\n');
  const keywords = new Set<string>();
  for (const line of lines.slice(1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const keyword = trimmed.split('\t')[0];
    if (keyword) keywords.add(keyword);
  }
  return keywords;
}

const LANGUAGE_CSV_HEADER = 'Keyword\tICELANDIC.TXT\tZENONSTR.TXT';

export function mergeZenonLanguageCsv(
  bays: Bay[],
  signalStates: SignalState[],
  zenonTagCategories: ZenonTagCategory[],
  csvText: string,
): string {
  const base = csvText.trim() || LANGUAGE_CSV_HEADER;
  const existing = parseLanguageCsvKeywords(base);
  const seen = new Set<string>();
  const newLines: string[] = [];

  function addLine(key: string, is: string | null | undefined, en: string | null | undefined) {
    if (!key || !is || seen.has(key) || existing.has(key)) return;
    seen.add(key);
    newLines.push(`${key}\t${is}\t${en ?? key}`);
  }

  for (const bay of bays) {
    for (const sig of bay.signals) {
      addLine(sig.signal_name, sig.name_is, sig.name_en);
    }
  }

  for (const st of signalStates) {
    for (const entry of Object.values(st.states)) {
      if (entry?.key) addLine(entry.key, entry.is, entry.en ?? null);
    }
  }

  for (const c of zenonTagCategories) {
    addLine(c.key, c.name_is, c.name_en);
  }

  if (newLines.length === 0) return base;
  return `${base}\n${newLines.join('\n')}`;
}

export function exportZenonLanguageCsv(bays: Bay[], signalStates: SignalState[], zenonTagCategories: ZenonTagCategory[], file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const buf = e.target!.result as ArrayBuffer;
        const bytes = new Uint8Array(buf);
        const isUtf16Le = bytes[0] === 0xFF && bytes[1] === 0xFE;
        const text = isUtf16Le
          ? new TextDecoder('utf-16le').decode(buf.slice(2))
          : new TextDecoder('utf-8').decode(buf);
        const merged = mergeZenonLanguageCsv(bays, signalStates, zenonTagCategories, text);
        const blob = new Blob([toUtf16Le(merged)], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Language.csv';
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      } catch {
        reject(new Error('Gat ekki lesið Language.csv'));
      }
    };
    reader.onerror = () => reject(new Error('Villa við lestur skrár'));
    reader.readAsArrayBuffer(file);
  });
}
