import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deserializePages,
  findNestedArrayPath,
  normalizeCutImages,
  serializePages
} from '../src/services/storyboard-serialization.js';

const createPage = () => ({
  images: [
    ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    [null]
  ],
  imageIndices: [1, 0],
  faceTexts: ['内容A', '内容B'],
  dialogueLines: [
    [
      { speaker: 'A', text: 'こんにちは' },
      { speaker: 'B', text: 'どうも' }
    ],
    [{ speaker: '', text: '' }]
  ],
  blendFiles: ['', 'scene.blend']
});

test('Firestore保存形式にネスト配列を残さない', () => {
  const serialized = serializePages([createPage()]);

  assert.equal(findNestedArrayPath(serialized), null);
  assert.deepEqual(serialized[0].images[0], {
    urls: ['https://example.com/a.jpg', 'https://example.com/b.jpg']
  });
  assert.deepEqual(serialized[0].dialogueLines[0], {
    lines: [
      { speaker: 'A', text: 'こんにちは' },
      { speaker: 'B', text: 'どうも' }
    ]
  });
});

test('画像とセリフを保存前後で欠損なく復元する', () => {
  const pages = [createPage()];

  assert.deepEqual(deserializePages(serializePages(pages)), pages);
});

test('既存の保存形式を再保存しても二重変換しない', () => {
  const once = serializePages([createPage()]);
  const twice = serializePages(once);

  assert.deepEqual(twice, once);
});

test('旧形式の画像配列と新形式のセリフを同時に読み込める', () => {
  const storedPages = [{
    images: [{ urls: ['old-image.jpg'] }, [null]],
    dialogueLines: [{
      lines: [{ speaker: '旧', text: 'データ' }]
    }]
  }];

  assert.deepEqual(deserializePages(storedPages), [{
    images: [['old-image.jpg'], [null]],
    dialogueLines: [[{ speaker: '旧', text: 'データ' }]]
  }]);
});

test('移行処理で旧・現行・Firestore画像形式を同じ配列へ正規化する', () => {
  assert.deepEqual(normalizeCutImages('legacy.jpg'), ['legacy.jpg']);
  assert.deepEqual(normalizeCutImages(['current.jpg']), ['current.jpg']);
  assert.deepEqual(normalizeCutImages({ urls: ['stored.jpg'] }), ['stored.jpg']);
  assert.deepEqual(normalizeCutImages(null), [null]);
});

test('undefinedをFirestoreで扱える値へ正規化する', () => {
  const serialized = serializePages([{
    images: [[undefined]],
    dialogueLines: [[{ speaker: undefined, text: '本文' }]],
    optionalField: undefined
  }]);

  assert.deepEqual(serialized, [{
    images: [{ urls: [null] }],
    dialogueLines: [{ lines: [{ text: '本文' }] }]
  }]);
});

test('将来追加された未対応のネスト配列を保存前に検出する', () => {
  assert.throws(
    () => serializePages([{ images: [[null]], customRows: [[1, 2]] }]),
    /root\[0\]\.customRows\[0\]/
  );
});
