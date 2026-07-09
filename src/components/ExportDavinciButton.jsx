import React, { useState } from 'react';
import JSZip from 'jszip';
import { fetchImageAsBlob } from '../services/image-fetcher';
import { buildFcpxml } from '../services/fcpxml-export';

const FPS = 24;
const TIMELINE_WIDTH = 1920;
const TIMELINE_HEIGHT = 1080;

const sanitizeFileName = (name) => {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'storyboard';
  return trimmed.replace(/[\\/:*?"<>|]/g, '_');
};

const pad4 = (n) => String(n).padStart(4, '0');

const ExportDavinciButton = ({ flatCuts, storyboardName }) => {
  const [exportName, setExportName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState('');

  const handleExport = async () => {
    if (!flatCuts || flatCuts.length === 0) return;
    setIsExporting(true);
    setStatus('画像を収集中...');

    try {
      const zip = new JSZip();
      const imagesFolder = zip.folder('images');
      const items = [];
      let failed = 0;

      for (let i = 0; i < flatCuts.length; i++) {
        const cut = flatCuts[i];
        const cutNumber = i + 1;
        const seconds = cut.timeValue;

        if (cut.image) {
          setStatus(`画像を取得中... (${cutNumber}/${flatCuts.length})`);
          try {
            const { blob, ext } = await fetchImageAsBlob(cut.image);
            const fileName = `${pad4(cutNumber)}.${ext}`;
            imagesFolder.file(fileName, blob);
            items.push({ hasImage: true, fileName: `images/${fileName}`, seconds });
          } catch (e) {
            console.warn('画像取得に失敗、ギャップとして扱います:', cut.image, e);
            failed += 1;
            items.push({ hasImage: false, seconds });
          }
        } else {
          items.push({ hasImage: false, seconds });
        }
      }

      setStatus('タイムラインを生成中...');
      const baseName = sanitizeFileName(exportName || storyboardName);
      const fcpxml = buildFcpxml({
        projectName: baseName,
        fps: FPS,
        width: TIMELINE_WIDTH,
        height: TIMELINE_HEIGHT,
        items
      });
      zip.file('timeline.fcpxml', fcpxml);

      setStatus('ZIPを書き出し中...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}_davinci.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus(failed > 0 ? `完了（画像${failed}件は取得できずギャップにしました）` : '完了しました');
    } catch (e) {
      console.error('DaVinci出力エラー:', e);
      setStatus('エラーが発生しました');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151' }}>
        <span style={{ whiteSpace: 'nowrap' }}>出力名</span>
        <input
          type="text"
          value={exportName}
          onChange={(e) => setExportName(e.target.value)}
          placeholder={storyboardName || 'storyboard'}
          disabled={isExporting}
          style={{
            width: '160px',
            padding: '6px 10px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontFamily: 'inherit',
            background: isExporting ? '#f3f4f6' : 'white'
          }}
        />
      </label>
      <button
        onClick={handleExport}
        disabled={isExporting}
        title="カットの画像と尺をDaVinci Resolve用のFCPXML＋画像ZIPで書き出します"
        style={{
          padding: '8px 24px',
          fontSize: '16px',
          background: isExporting ? '#a78bfa' : '#7c3aed',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isExporting ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap'
        }}
      >
        {isExporting ? 'DaVinci出力中...' : 'DaVinci Resolve出力'}
      </button>
      {status && (
        <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{status}</span>
      )}
    </div>
  );
};

export default ExportDavinciButton;
