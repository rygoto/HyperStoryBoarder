// フレーム抽出機能
export const extractContextFrames = (pages, currentPageIdx, currentCutIdx) => {
  if (!pages || pages.length === 0) {
    return {
      previousFrame: null,
      currentFrame: null,
      nextFrame: null,
      fallbackFrames: [],
      frameNumbers: [0, 0, 0]
    };
  }

  const currentGlobalIdx = currentPageIdx * 5 + currentCutIdx;
  const flatImages = pages.flatMap(page => page.images);
  
  const previousFrame = currentGlobalIdx > 0 
    ? flatImages[currentGlobalIdx - 1] 
    : null;
    
  const currentFrame = flatImages[currentGlobalIdx];
  
  const nextFrame = currentGlobalIdx < flatImages.length - 1 
    ? flatImages[currentGlobalIdx + 1] 
    : null;
  
  // 前後にフレームがない場合の代替（1-2個前後）
  const fallbackFrames = [];
  if (!previousFrame && currentGlobalIdx >= 2) {
    fallbackFrames.push(flatImages[currentGlobalIdx - 2]);
  }
  if (!nextFrame && currentGlobalIdx <= flatImages.length - 3) {
    fallbackFrames.push(flatImages[currentGlobalIdx + 2]);
  }
  
  return {
    previousFrame,
    currentFrame,
    nextFrame,
    fallbackFrames,
    frameNumbers: [
      Math.max(0, currentGlobalIdx - 1), 
      currentGlobalIdx, 
      Math.min(flatImages.length - 1, currentGlobalIdx + 1)
    ]
  };
};

// フレーム情報の取得（テキスト情報も含む）
export const getFrameData = (pages, pageIdx, cutIdx) => {
  if (!pages || !pages[pageIdx]) {
    return null;
  }

  const page = pages[pageIdx];
  return {
    image: page.images[cutIdx],
    faceText: page.faceTexts[cutIdx],
    dialogueText: page.dialogueTexts[cutIdx],
    timeValue: page.timeValues[cutIdx],
    blendFile: page.blendFiles[cutIdx],
    pageIdx,
    cutIdx
  };
}; 