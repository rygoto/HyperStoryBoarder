import React from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ref as storageRef, getBytes } from 'firebase/storage';
import { storage } from '../config/firebase';

const isFirebaseStorageUrl = (url) =>
  url.includes('firebasestorage.googleapis.com') ||
  url.includes('.firebasestorage.app');

// Firebase Storage URLからストレージパスを抽出する
// 例: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/images%2Fuid%2Ffile.jpg?alt=media&token=...
const parseStoragePath = (url) => {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// Firebase Storage SDKのgetBytesを使ってCORS制限を回避しつつ画像をData URLに変換する
const fetchImageAsDataURL = async (url) => {
  if (isFirebaseStorageUrl(url)) {
    const path = parseStoragePath(url);
    if (path) {
      const imageRef = storageRef(storage, path);
      const bytes = await getBytes(imageRef);
      const lowerUrl = url.toLowerCase();
      const mimeType = lowerUrl.includes('.png') ? 'image/png'
        : lowerUrl.includes('.gif') ? 'image/gif'
        : lowerUrl.includes('.webp') ? 'image/webp'
        : 'image/jpeg';
      const blob = new Blob([bytes], { type: mimeType });
      return blobToDataURL(blob);
    }
  }
  // Firebase以外のURLはfetchで試みる
  const res = await fetch(url, { cache: 'force-cache' });
  const blob = await res.blob();
  return blobToDataURL(blob);
};

// ページ内の全<img>をData URLに差し替え、元のsrcリストを返す
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
      const dataUrl = await fetchImageAsDataURL(src);
      originals.push({ img, src });
      img.src = dataUrl;
      await new Promise((resolve) => {
        if (img.complete) { resolve(); return; }
        img.onload = resolve;
        img.onerror = resolve;
      });
    } catch (e) {
      console.warn('画像のData URL変換に失敗:', src, e);
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