export const DEFAULT_DIALOGUE_CHARS_PER_SECOND = 5;

export const EMPTY_DIALOGUE_LINE = () => ({ speaker: '', text: '' });

export const emptyDialogueLinesForPage = () =>
  Array.from({ length: 5 }, () => [EMPTY_DIALOGUE_LINE()]);

const splitSpeakerAndText = (line) => {
  const fullWidth = line.indexOf('：');
  const halfWidth = line.indexOf(':');
  let colonIdx = -1;
  if (fullWidth >= 0 && halfWidth >= 0) colonIdx = Math.min(fullWidth, halfWidth);
  else if (fullWidth >= 0) colonIdx = fullWidth;
  else if (halfWidth >= 0) colonIdx = halfWidth;
  if (colonIdx >= 0) {
    return {
      speaker: line.slice(0, colonIdx).trim(),
      text: line.slice(colonIdx + 1).trim()
    };
  }
  return { speaker: '', text: line.trim() };
};

export const parseLegacyDialogueText = (text) => {
  if (!text || !String(text).trim()) return [EMPTY_DIALOGUE_LINE()];
  const rows = String(text).split('\n').map(l => l.trim()).filter(Boolean);
  if (rows.length === 0) return [EMPTY_DIALOGUE_LINE()];
  return rows.map(splitSpeakerAndText);
};

export const normalizeDialogueLineArray = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) return [EMPTY_DIALOGUE_LINE()];
  return lines.map((line) => ({
    speaker: line?.speaker ?? '',
    text: line?.text ?? ''
  }));
};

export const getCutDialogueLines = (page, cutIdx) => {
  if (page.dialogueLines?.[cutIdx]) {
    return normalizeDialogueLineArray(page.dialogueLines[cutIdx]);
  }
  return parseLegacyDialogueText(page.dialogueTexts?.[cutIdx] || '');
};

export const normalizePageDialogues = (page) => {
  const dialogueLines = Array.from({ length: 5 }, (_, cutIdx) =>
    getCutDialogueLines(page, cutIdx)
  );
  return { ...page, dialogueLines };
};

export const formatDialogueDisplay = (lines) =>
  normalizeDialogueLineArray(lines)
    .filter((line) => line.speaker || line.text)
    .map((line) => (line.speaker ? `${line.speaker}：${line.text}` : line.text))
    .join('\n');

export const formatDialogueSpeakText = (lines) =>
  normalizeDialogueLineArray(lines)
    .filter((line) => line.text)
    .map((line) => line.text)
    .join('、');

export const countDialogueLinesChars = (lines) =>
  normalizeDialogueLineArray(lines).reduce(
    (sum, line) => sum + (line.text || '').replace(/\s/g, '').length,
    0
  );

export const isDialogueLinesFilled = (lines) =>
  normalizeDialogueLineArray(lines).some((line) => line.speaker !== '' || line.text !== '');

export const calcTimingFromDialogueLines = (lines, fps, charsPerSecond = DEFAULT_DIALOGUE_CHARS_PER_SECOND) => {
  const cps = parseFloat(charsPerSecond);
  const rate = !isNaN(cps) && cps > 0 ? cps : DEFAULT_DIALOGUE_CHARS_PER_SECOND;
  const charCount = countDialogueLinesChars(lines);
  if (charCount === 0) return null;
  const seconds = charCount / rate;
  const secStr = seconds.toFixed(4).replace(/\.?0+$/, '') || '0';
  const frames = String(Math.max(1, Math.round(seconds * fps)));
  return { frames, seconds: secStr };
};
