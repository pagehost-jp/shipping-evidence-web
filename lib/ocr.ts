/**
 * OCRサービス（Gemini Vision API）
 *
 * 【設計思想】
 * - OCRは「候補を出すだけ」
 * - ユーザーが最終確認・修正する
 * - OCRが失敗しても保存できる
 */

export interface OcrResult {
  trackingNumberCandidate?: string;
  dateCandidate?: string;
  confidence?: number;
  rawText?: string;
}

/**
 * Gemini Vision APIで画像から伝票番号を抽出
 */
export async function performOCR(imageFile: File): Promise<OcrResult> {
  try {
    console.log('[OCR] 開始:', imageFile.name);

    // Gemini API キー確認
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      console.warn('[OCR] APIキーが設定されていません');
      return { confidence: 0 };
    }

    // 画像をBase64に変換
    const base64Image = await fileToBase64(imageFile);
    const imageData = base64Image.split(',')[1]; // data:image/... の部分を削除

    // Gemini Vision API 呼び出し
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `この配送伝票の画像から、以下の情報を抽出してください：

1. 「お問い合わせ伝票番号」（ハイフン付きの番号、例: 2874-7496-3580）
2. 日付（YYYY-MM-DD形式）

JSONフォーマットで回答してください：
{
  "trackingNumber": "伝票番号",
  "date": "YYYY-MM-DD",
  "confidence": 0.0〜1.0
}`,
                },
                {
                  inline_data: {
                    mime_type: imageFile.type,
                    data: imageData,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('[OCR] API エラー:', response.status);
      return { confidence: 0 };
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.warn('[OCR] テキスト抽出失敗');
      return { confidence: 0 };
    }

    console.log('[OCR] 生テキスト:', text);

    // JSON抽出（```json ... ``` の中身を取得）
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      // JSONが見つからない場合、正規表現で伝票番号を直接抽出
      const trackingMatch = text.match(/\d{4}-\d{4}-\d{4}/);
      if (trackingMatch) {
        console.log('[OCR] 伝票番号のみ抽出成功:', trackingMatch[0]);
        return {
          trackingNumberCandidate: trackingMatch[0],
          confidence: 0.8,
          rawText: text,
        };
      }

      console.warn('[OCR] 伝票番号が見つかりませんでした');
      return { confidence: 0, rawText: text };
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonText);

    const ocrResult: OcrResult = {
      trackingNumberCandidate: parsed.trackingNumber || undefined,
      dateCandidate: parsed.date || undefined,
      confidence: parsed.confidence || 0.8,
      rawText: text,
    };

    console.log('[OCR] 抽出成功:', ocrResult);
    return ocrResult;
  } catch (error) {
    console.error('[OCR] エラー:', error);
    return { confidence: 0 };
  }
}

/**
 * FileをBase64文字列に変換
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * フォールバック：クライアント側正規表現OCR
 * （Gemini APIが使えない場合の簡易版）
 */
export function extractTrackingNumberFromText(text: string): string | null {
  // 伝票番号パターン: XXXX-XXXX-XXXX
  const match = text.match(/\d{4}-\d{4}-\d{4}/);
  return match ? match[0] : null;
}
