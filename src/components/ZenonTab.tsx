import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useApi } from '../context/ApiContext';
import { useLibrary } from '../context/LibraryContext';
import { loadZenonConfig, saveZenonConfig } from '../services/zenonConfigService';
import { exportZenonAllBaysVariables, exportZenonAllBaysRematrix, exportZenonLanguageCsv } from '../services/exportService';
import { Button } from './ui';
import type { Equipment, Bay, ZenonConfig } from '../types';

interface Props {
  projectId: string;
  projectName: string;
  ieds: Equipment[];
  apparatus: Equipment[];
  bays: Bay[];
}

export function ZenonTab({ projectId, projectName, ieds, apparatus, bays }: Props) {
  const { api } = useApi();
  const { signalStates, zenonTagCategories } = useLibrary();

  const [config, setConfig] = useState<ZenonConfig>({ driver_name: 'IEC850', net_addr: {} });
  const [sha, setSha] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadZenonConfig(api, projectId).then(({ data, sha: s }) => {
      setConfig(data);
      setSha(s);
    });
  }, [api, projectId]);

  const setNetAddr = useCallback((iedName: string, val: number) => {
    setConfig(prev => ({
      ...prev,
      net_addr: { ...prev.net_addr, [iedName]: val },
    }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newSha = await saveZenonConfig(api, projectId, config, sha);
      setSha(newSha);
    } finally {
      setSaving(false);
    }
  };

  const apparatusTypeMap = useMemo(
    () => Object.fromEntries(apparatus.filter(e => e.type).map(e => [e.code, e.type!])),
    [apparatus],
  );

  const handleExportVar = () => {
    exportZenonAllBaysVariables(bays, projectName, signalStates, config.driver_name, config.net_addr, apparatusTypeMap);
  };

  const handleExportRema = () => {
    exportZenonAllBaysRematrix(bays, projectName, signalStates);
  };

  const langInputRef = useRef<HTMLInputElement>(null);

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '5px 8px', fontSize: '12px', outline: 'none',
  };
  const headStyle: React.CSSProperties = {
    padding: '6px 10px', background: 'var(--surface-alt)',
    borderBottom: '1px solid var(--line)', fontWeight: 600,
    color: 'var(--text-secondary)', textAlign: 'left', fontSize: '12px',
  };
  const cellStyle: React.CSSProperties = {
    padding: '6px 10px', borderBottom: '1px solid var(--line-muted)', fontSize: '13px',
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <label style={{ fontSize: '13px', color: 'var(--text-secondary)', minWidth: 100 }}>Driver nafn:</label>
        <input
          style={{ ...inputStyle, width: 200 }}
          value={config.driver_name}
          onChange={e => setConfig(prev => ({ ...prev, driver_name: e.target.value }))}
        />
      </div>

      {ieds.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--space-5)' }}>
          <thead>
            <tr>
              <th style={headStyle}>IED (ied_name)</th>
              <th style={headStyle}>Tæki (code)</th>
              <th style={{ ...headStyle, width: 90 }}>NetAddr</th>
            </tr>
          </thead>
          <tbody>
            {ieds.map(ied => {
              const iedName = ied.ied_name;
              const val = iedName != null ? (config.net_addr[iedName] ?? 0) : 0;
              return (
                <tr key={ied.id}>
                  <td style={cellStyle}>{iedName ?? <em style={{ color: 'var(--muted)' }}>vantar ied_name</em>}</td>
                  <td style={cellStyle}>{ied.code}</td>
                  <td style={cellStyle}>
                    <input
                      type="number"
                      min={0}
                      style={{ ...inputStyle, width: 70 }}
                      value={iedName != null ? val : 0}
                      disabled={iedName == null}
                      onChange={e => {
                        if (iedName != null) setNetAddr(iedName, parseInt(e.target.value, 10) || 0);
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {ieds.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Engin IED tæki skráð í verkefninu.</p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Button onClick={handleExportVar} size="sm">↓ zenon var</Button>
        <Button onClick={handleExportRema} size="sm">↓ zenon rema</Button>
        <input
          ref={langInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) exportZenonLanguageCsv(bays, signalStates, zenonTagCategories, f);
            e.target.value = '';
          }}
        />
        <Button onClick={() => langInputRef.current?.click()} size="sm">↓ zenon lang</Button>
        <Button onClick={handleSave} size="sm" disabled={saving}>
          {saving ? 'Vista...' : 'Vista'}
        </Button>
      </div>
    </div>
  );
}
