/**
 * OCR APIルート（サーバーサイド）
 *
 * 【セキュリティ】
 * - APIキーはサーバー側の環境変数から取得
 * - ブラウザに露出しない
 *
 * 【設計】
 * - multipart/form-data で画像受け取り
 * - Gemini Visionで伝票番号抽出
 * - 失敗しても200を返す（クライアントは手入力へ）
 */

import { NextRequest, NextResponse } from 'next/server';
import { callGemini, extractTrackingNumber } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 30; // 最大30秒

/**
 * POST /api/ocr
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[OCR API] リクエスト受信');

    // FormDataから画像取得
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json(
        {
          success: false,
          trackingNumberCandidate: null,
          error: 'No image file provided',
        },
        { status: 400 }
      );
    }

    console.log('[OCR API] 画像受信:', imageFile.name, imageFile.type, imageFile.size);

    // 画像をBase64に変換
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    // Gemini Vision呼び出し
    const geminiResponse = await callGemini({
      prompt: `この配送伝票の画像から、「お問い合わせ伝票番号」を抽出してください。

伝票番号の形式: XXXX-XXXX-XXXX（数字4桁-数字4桁-数字4桁）

抽出できた場合は伝票番号のみを返してください。
抽出できない場合は "NOT_FOUND" と返してください。`,
      imageData: base64Image,
      mimeType: imageFile.type,
      temperature: 0.1,
      maxTokens: 128,
    });

    if (!geminiResponse.success) {
      console.warn('[OCR API] Gemini呼び出し失敗:', geminiResponse.error);

      // APIキーがない場合は無言で失敗（クライアントは手入力へ）
      if (geminiResponse.error?.type === 'API_KEY_MISSING') {
        return NextResponse.json({
          success: false,
          trackingNumberCandidate: null,
          error: null, // クライアントには通知しない
        });
      }

      return NextResponse.json({
        success: false,
        trackingNumberCandidate: null,
        error: geminiResponse.error?.message,
      });
    }

    const rawText = geminiResponse.text;
    console.log('[OCR API] Gemini応答:', rawText);

    // 正規表現で伝票番号抽出
    const trackingNumber = extractTrackingNumber(rawText);

    if (!trackingNumber) {
      console.log('[OCR API] 伝票番号が見つかりませんでした');
      return NextResponse.json({
        success: false,
        trackingNumberCandidate: null,
        rawText,
      });
    }

    console.log('[OCR API] 抽出成功:', trackingNumber);

    return NextResponse.json({
      success: true,
      trackingNumberCandidate: trackingNumber,
      rawText,
    });
  } catch (error: any) {
    console.error('[OCR API] エラー:', error);

    return NextResponse.json(
      {
        success: false,
        trackingNumberCandidate: null,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
