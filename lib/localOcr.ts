/**
 * ローカルOCR（Tesseract.js）
 *
 * 【メリット】
 * - APIキー不要
 * - ブラウザで完結
 * - オフライン動作
 * - 無料
 *
 * 【設計】
 * - OCRは「候補を出すだけ」
 * - 失敗しても手入力で保存可能
 */

import Tesseract from 'tesseract.js';

export interface LocalOcrResult {
  trackingNumberCandidate?: string;
  rawText?: string;
  confidence?: number;
}

export interface OcrProgress {
  status: string;
  progress: number;
}

/**
 * ブラウザ内でOCR実行（日本語+英語対応）
 */
export async function performLocalOCR(
  imageFile: File,
  onProgress?: (progress: OcrProgress) => void
): Promise<LocalOcrResult> {
  try {
    console.log('[Local OCR] 開始:', imageFile.name);

    // Tesseract.js でOCR実行
    const result = await Tesseract.recognize(
      imageFile,
      'jpn+eng', // 日本語+英語
      {
        logger: (m) => {
          console.log('[Local OCR]', m);
          if (onProgress && m.status && m.progress !== undefined) {
            onProgress({
              status: m.status,
              progress: m.progress,
            });
          }
        },
      }
    );

    const rawText = result.data.text;
    const confidence = result.data.confidence;

    console.log('[Local OCR] 抽出テキスト:', rawText);
    console.log('[Local OCR] 信頼度:', confidence);

    // 正規表現で伝票番号を抽出（XXXX-XXXX-XXXX形式）
    const trackingNumber = extractTrackingNumber(rawText);

    if (trackingNumber) {
      console.log('[Local OCR] 伝票番号検出:', trackingNumber);
      return {
        trackingNumberCandidate: trackingNumber,
        rawText,
        confidence: confidence / 100, // 0-100 → 0-1
      };
    } else {
      console.log('[Local OCR] 伝票番号が見つかりませんでした');
      return {
        rawText,
        confidence: confidence / 100,
      };
    }
  } catch (error) {
    console.error('[Local OCR] エラー:', error);
    return {
      confidence: 0,
    };
  }
}

/**
 * テキストから伝票番号を抽出
 * パターン: XXXX-XXXX-XXXX（数字4桁-数字4桁-数字4桁）
 */
function extractTrackingNumber(text: string): string | null {
  // ハイフン付き伝票番号
  const match = text.match(/\b\d{4}-\d{4}-\d{4}\b/);
  if (match) {
    return match[0];
  }

  // スペースや改行を除去して連続した12桁を探す
  const cleanText = text.replace(/\s+/g, '');
  const match12 = cleanText.match(/\d{12}/);
  if (match12) {
    // XXXXXXXXXXXX → XXXX-XXXX-XXXX に整形
    const num = match12[0];
    return `${num.slice(0, 4)}-${num.slice(4, 8)}-${num.slice(8, 12)}`;
  }

  return null;
}
