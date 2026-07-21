// 絵コンテのカット列からDaVinci Resolve向けFCPXMLを生成する。
//
// - 各カットの尺(timeValue: 秒)をフレーム単位に変換してクリップ長にする
// - 画像のあるカットは <video>（静止画クリップ）として配置
// - 画像がない / 尺だけのカットは <gap>（尺ぶんの空き）として残す
// - 尺が未指定のカットは再生時と同じく1秒をデフォルトにする

const DEFAULT_SECONDS = 1;

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// 秒数をフレーム数へ変換（最低1フレーム）
const secondsToFrames = (seconds, fps) => {
  const s = parseFloat(seconds);
  const value = Number.isFinite(s) && s > 0 ? s : DEFAULT_SECONDS;
  return Math.max(1, Math.round(value * fps));
};

/**
 * FCPXMLを生成する。
 * @param {Object} params
 * @param {string} params.projectName プロジェクト名
 * @param {number} params.fps 整数フレームレート (例: 24)
 * @param {number} params.width タイムライン幅
 * @param {number} params.height タイムライン高さ
 * @param {Array<{ hasImage: boolean, fileName?: string, seconds: (number|string) }>} params.items
 *        カット順の配列。hasImage=true のものは fileName（images/配下の相対パス）を持つ。
 * @returns {string} FCPXML文字列
 */
export const buildFcpxml = ({ projectName, fps, width, height, items }) => {
  const timebase = Math.round(fps) * 100; // 例: 24fps -> 2400
  const frameDur = `100/${timebase}s`;
  const framesToTime = (frames) => `${frames * 100}/${timebase}s`;

  const assets = [];
  const spineElements = [];
  let offsetFrames = 0;
  let assetSeq = 0;

  items.forEach((item, index) => {
    const frames = secondsToFrames(item.seconds, fps);
    const clipName = escapeXml(`Cut ${index + 1}`);

    if (item.hasImage && item.fileName) {
      assetSeq += 1;
      const assetId = `a${assetSeq}`;
      const src = escapeXml(item.fileName); // 例: images/0001.png（fcpxmlからの相対パス）
      assets.push(
        // 静止画はレート未定義フォーマット(rStill)を参照する。
        // frameDuration付きの動画フォーマットを参照すると、Resolveが
        // 「その尺ぶんのフレームがある動画」と誤解し、2フレーム目以降の
        // 中身が無いためチカチカ切り替わって見える。
        `    <asset id="${assetId}" name="${clipName}" start="0s" duration="${framesToTime(frames)}" ` +
          `hasVideo="1" format="rStill" videoSources="1">\n` +
          `      <media-rep kind="original-media" src="${src}"/>\n` +
          `    </asset>`
      );
      spineElements.push(
        `        <video ref="${assetId}" name="${clipName}" ` +
          `offset="${framesToTime(offsetFrames)}" start="0s" duration="${framesToTime(frames)}"/>`
      );
    } else {
      spineElements.push(
        `        <gap name="${clipName}" offset="${framesToTime(offsetFrames)}" ` +
          `start="0s" duration="${framesToTime(frames)}"/>`
      );
    }

    offsetFrames += frames;
  });

  const totalDuration = framesToTime(offsetFrames);
  const safeProjectName = escapeXml(projectName || 'Storyboard');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="FFVideoFormat${Math.round(fps)}p" frameDuration="${frameDur}" width="${width}" height="${height}" colorSpace="1-1-1 (Rec. 709)"/>
    <format id="rStill" name="FFVideoFormatRateUndefined" width="${width}" height="${height}" colorSpace="1-1-1 (Rec. 709)"/>
${assets.join('\n')}
  </resources>
  <library>
    <event name="${safeProjectName}">
      <project name="${safeProjectName}">
        <sequence format="r1" duration="${totalDuration}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${spineElements.join('\n')}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
};

export const secondsToFramesForTest = secondsToFrames;
