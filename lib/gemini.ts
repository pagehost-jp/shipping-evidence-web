/**
 * Gemini API 共通ヘルパー
 *
 * 【外部APIは壊れる前提】
 * - モデル名・エンドポイントは1箇所で管理
 * - フォールバック機能
 * - エラー分類ログ
 * - タイムアウト設定
 */

// ────────────────────────────
// 設定（ここを変更すれば全体に反映）
// ────────────────────────────

const GEMINI_CONFIG = {
  // モデル設定（ベタ書き禁止、ここで一元管理）
  primaryModel: 'gemini-1.5-flash',
  fallbackModel: 'gemini-1.5-pro', // プライマリが失敗した時のフォールバック

  // エンドポイント
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',

  // タイムアウト設定
  timeout: 10000, // 10秒

  // リトライ設定
  maxRetries: 2,
  retryDelay: 1000, // 1秒
};

// ────────────────────────────
// 型定義
// ────────────────────────────

export interface GeminiRequest {
  prompt: string;
  imageData?: string; // base64 encoded image data (without data:image/... prefix)
  mimeType?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GeminiResponse {
  text: string;
  success: boolean;
  error?: GeminiError;
}

export interface GeminiError {
  type: 'API_KEY_MISSING' | 'NETWORK_ERROR' | 'API_ERROR' | 'TIMEOUT' | 'PARSE_ERROR' | 'UNKNOWN';
  message: string;
  statusCode?: number;
  originalError?: unknown;
}

// ────────────────────────────
// メイン関数
// ────────────────────────────

/**
 * Gemini APIを呼び出す（フォールバック付き）
 */
export async function callGemini(request: GeminiRequest): Promise<GeminiResponse> {
  // APIキー確認
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('[Gemini] APIキーが設定されていません');
    return {
      text: '',
      success: false,
      error: {
        type: 'API_KEY_MISSING',
        message: 'GEMINI_API_KEY environment variable is not set',
      },
    };
  }

  // プライマリモデルで試行
  const primaryResult = await callGeminiWithModel(
    apiKey,
    GEMINI_CONFIG.primaryModel,
    request
  );

  if (primaryResult.success) {
    return primaryResult;
  }

  // フォールバック: セカンダリモデルで再試行
  console.warn('[Gemini] プライマリモデル失敗、フォールバックモデルで再試行');
  const fallbackResult = await callGeminiWithModel(
    apiKey,
    GEMINI_CONFIG.fallbackModel,
    request
  );

  return fallbackResult;
}

/**
 * 指定モデルでGemini APIを呼び出す
 */
async function callGeminiWithModel(
  apiKey: string,
  model: string,
  request: GeminiRequest
): Promise<GeminiResponse> {
  try {
    console.log(`[Gemini] 呼び出し開始: ${model}`);

    // リクエストボディ構築
    const parts: any[] = [{ text: request.prompt }];

    if (request.imageData && request.mimeType) {
      parts.push({
        inline_data: {
          mime_type: request.mimeType,
          data: request.imageData,
        },
      });
    }

    const body = {
      contents: [{ parts }],
      generationConfig: {
        temperature: request.temperature ?? 0.1,
        maxOutputTokens: request.maxTokens ?? 256,
      },
    };

    // タイムアウト付きfetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_CONFIG.timeout);

    const response = await fetch(
      `${GEMINI_CONFIG.endpoint}/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    // HTTPステータスエラー
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[Gemini] API Error (${response.status}):`, errorText);

      return {
        text: '',
        success: false,
        error: {
          type: 'API_ERROR',
          message: `API returned ${response.status}: ${errorText}`,
          statusCode: response.status,
        },
      };
    }

    // レスポンスパース
    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('[Gemini] テキスト抽出失敗:', result);
      return {
        text: '',
        success: false,
        error: {
          type: 'PARSE_ERROR',
          message: 'No text found in API response',
        },
      };
    }

    console.log(`[Gemini] 成功: ${model}`);
    return {
      text,
      success: true,
    };
  } catch (error: any) {
    // エラー分類
    if (error.name === 'AbortError') {
      console.error('[Gemini] タイムアウト');
      return {
        text: '',
        success: false,
        error: {
          type: 'TIMEOUT',
          message: `Request timeout after ${GEMINI_CONFIG.timeout}ms`,
          originalError: error,
        },
      };
    }

    if (error.message?.includes('fetch')) {
      console.error('[Gemini] ネットワークエラー:', error);
      return {
        text: '',
        success: false,
        error: {
          type: 'NETWORK_ERROR',
          message: error.message,
          originalError: error,
        },
      };
    }

    console.error('[Gemini] 不明なエラー:', error);
    return {
      text: '',
      success: false,
      error: {
        type: 'UNKNOWN',
        message: error.message || 'Unknown error occurred',
        originalError: error,
      },
    };
  }
}

/**
 * テキストから正規表現で伝票番号を抽出
 */
export function extractTrackingNumber(text: string): string | null {
  // パターン: XXXX-XXXX-XXXX
  const match = text.match(/\b\d{4}-\d{4}-\d{4}\b/);
  return match ? match[0] : null;
}
