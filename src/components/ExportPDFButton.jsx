import React from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Firebase StorageなどのクロスオリジンURLをData URLに変換してimg.srcを差し替える
const replaceImagesWithDataURLs = async (element) => {
  const imgs = Array.from(element.querySelectorAll('img'));
  const originals = [];

  await Promise.all(imgs.map(async (img) => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
      originals.push({ img, src });
      return;
    }
    try {
      const res = await fetch(src, { mode: 'cors', cache: 'force-cache' });
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      originals.push({ img, src });
      img.src = dataUrl;
      // 新しいsrcが読み込まれるのを待つ
      await new Promise((resolve) => {
        if (img.complete) { resolve(); return; }
        img.onload = resolve;
        img.onerror = resolve;
      });
    } catch {
      originals.push({ img, src });
    }
  }));

  return originals;
};

const restoreImages = (originals) => {
  for (const { img, src } of originals) {
    img.src = src;
  }
};

const ExportPDFButton = ({ pageRefs, pages, setIsExportingPDF }) => {
  const handleExport = async () => {
    if (!pageRefs || !pageRefs.current || pageRefs.current.length === 0) return;
    if (!setIsExportingPDF) return;
    setIsExportingPDF(true);
    // 画面更新を待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    for (let i = 0; i < pages.length; i++) {
      const element = pageRefs.current[i];
      if (!element) continue;

      // クロスオリジン画像をData URLに差し替えてCORS問題を回避
      const originals = await replaceImagesWithDataURLs(element);

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: false,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        letterRendering: true,
        imageTimeout: 15000,
        removeContainer: true,
        foreignObjectRendering: false,
        logging: false
      });

      // 元のsrcに戻す
      restoreImages(originals);
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);
      const imgAspectRatio = canvas.width / canvas.height;
      const pdfAspectRatio = availableWidth / availableHeight;
      let finalWidth, finalHeight;
      if (imgAspectRatio > pdfAspectRatio) {
        finalWidth = availableWidth;
        finalHeight = availableWidth / imgAspectRatio;
      } else {
        finalHeight = availableHeight;
        finalWidth = availableHeight * imgAspectRatio;
      }
      if (finalHeight <= availableHeight) {
        const xOffset = margin + (availableWidth - finalWidth) / 2;
        const yOffset = margin + (availableHeight - finalHeight) / 2;
        pdf.addImage(
          imgData,
          'PNG',
          xOffset,
          yOffset,
          finalWidth,
          finalHeight
        );
      } else {
        const totalHeight = finalHeight;
        let currentY = 0;
        let pageNumber = 0;
        while (currentY < totalHeight) {
          if (pageNumber > 0) {
            pdf.addPage();
          }
          const remainingHeight = totalHeight - currentY;
          const pageHeight = Math.min(availableHeight, remainingHeight);
          const sourceY = (currentY / totalHeight) * canvas.height;
          const sourceHeight = (pageHeight / totalHeight) * canvas.height;
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          tempCanvas.width = canvas.width;
          tempCanvas.height = sourceHeight;
          tempCtx.drawImage(
            canvas,
            0, sourceY, canvas.width, sourceHeight,
            0, 0, canvas.width, sourceHeight
          );
          const pageImgData = tempCanvas.toDataURL('image/png', 1.0);
          const xOffset = margin + (availableWidth - finalWidth) / 2;
          pdf.addImage(
            pageImgData,
            'PNG',
            xOffset,
            margin,
            finalWidth,
            pageHeight
          );
          currentY += availableHeight;
          pageNumber++;
        }
      }
      pdf.save(`storyboard_page${i + 1}.pdf`);
    }
    setIsExportingPDF(false);
  };

  return (
    <button
      onClick={handleExport}
      style={{
        margin: '16px',
        padding: '8px 24px',
        fontSize: '16px',
        background: '#2563eb',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'inherit'
      }}
    >
      各ページごとにPDF保存
    </button>
  );
};

export default ExportPDFButton;