import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { useLibrary } from '../context/LibraryContext';
import { useProjectNav } from '../context/ProjectNavContext';
import { loadProject } from '../services/projectService';
import { listBays } from '../services/bayService';
import { loadZenonConfig, saveZenonConfig } from '../services/zenonConfigService';
import {
  exportZenonAllBaysVariables,
  exportZenonAllBaysRematrix,
  exportZenonLanguageCsv,
} from '../services/exportService';
import { Button } from '../components/ui';
import type { Equipment, Bay, ZenonConfig } from '../types';

export function ZenonView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { api } = useApi();
  const { signalStates, zenonTagCategories } = useLibrary();
  const { setProject } = useProjectNav();

  const [projectName, setProjectName] = useState('');
  const [ieds, setIeds] = useState<Equipment[]>([]);
  const [apparatus, setApparatus] = useState<Equipment[]>([]);
  const [bays, setBays] = useState<Bay[]>([]);
  const [loading, setLoading] = useState(true);

  const [config, setConfig] = useState<ZenonConfig>({ driver_name: 'IEC850', net_addr: {} });
  const [sha, setSha] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      loadProject(api, projectId),
      listBays(api, projectId),
      loadZenonConfig(api, projectId),
    ]).then(([files, bayList, zenonFile]) => {
      setProjectName(files.project.name);
      setProject(projectId, files.project.name);
      const equip: Equipment[] = files.equipment;
      setIeds(equip.filter(e => e.category === 'ied'));
      setApparatus(equip.filter(e => e.category === 'apparatus'));
      setBays(bayList);
      setConfig(zenonFile.data);
      setSha(zenonFile.sha);
    }).finally(() => setLoading(false));
  }, [api, projectId]);

  const setNetAddr = useCallback((iedName: string, val: number) => {
    setConfig(prev => ({
      ...prev,
      net_addr: { ...prev.net_addr, [iedName]: val },
    }));
  }, []);

  const handleSave = async () => {
    if (!projectId) return;
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

  const handleExportAll = () => {
    exportZenonAllBaysVariables(bays, projectName, signalStates, config.driver_name, config.net_addr, apparatusTypeMap);
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

  if (loading) return <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Hleður...</p>;

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 'var(--space-5)', color: 'var(--text)' }}>
        Zenon útflutningur
      </h2>

      {/* Export section */}
      <section style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Button onClick={handleExportAll} size="sm" style={{ fontWeight: 600 }}>
            ↓ Allt (var + rema)
          </Button>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button onClick={handleExportVar} size="sm" variant="ghost">↓ var</Button>
          <Button onClick={handleExportRema} size="sm" variant="ghost">↓ rema</Button>
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
          <Button onClick={() => langInputRef.current?.click()} size="sm" variant="ghost">↓ lang</Button>
        </div>
      </section>

      {/* Driver name */}
      <section style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)', minWidth: 100 }}>Driver nafn:</label>
          <input
            style={{ ...inputStyle, width: 200 }}
            value={config.driver_name}
            onChange={e => setConfig(prev => ({ ...prev, driver_name: e.target.value }))}
          />
        </div>
      </section>

      {/* IED NetAddr table */}
      {ieds.length > 0 && (
        <section style={{ marginBottom: 'var(--space-4)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--space-3)' }}>
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
        </section>
      )}

      {ieds.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: 'var(--space-4)' }}>
          Engin IED tæki skráð í verkefninu.
        </p>
      )}

      <Button onClick={handleSave} size="sm" disabled={saving}>
        {saving ? 'Vista...' : 'Vista stillingar'}
      </Button>
    </div>
  );
}
