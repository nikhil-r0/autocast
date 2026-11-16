import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import dns from 'dns';
import { KaneStep } from '../types.js';

// Ensure IPv4 first to avoid IPv6 timeout delay
dns.setDefaultResultOrder('ipv4first');
dotenv.config();

export interface SceneNarration {
  stepIndex: number;
  caption: string;
  narration: string;
}

const DEFAULT_NARRATIONS: SceneNarration[] = [
  {
    stepIndex: 1,
    caption: '12 invoices waiting',
    narration: 'Twelve invoices await executive review, led by INV-1042.',
  },
  {
    stepIndex: 2,
    caption: 'Review INV-1042',
    narration: 'Open INV-1042 to inspect Kubernetes cluster infrastructure charges.',
  },
  {
    stepIndex: 3,
    caption: 'Apex, $4,850.00',
    narration: 'Production compute and multi-AZ data transfer total $4,850.00.',
  },
  {
    stepIndex: 4,
    caption: 'Approve Invoice',
    narration: 'Approve Invoice with required budget verification note.',
  },
  {
    stepIndex: 5,
    caption: 'Approved seal',
    narration: 'The green Approved compliance seal stamps into document preview.',
  },
  {
    stepIndex: 6,
    caption: 'Pending drops to 11',
    narration: 'INV-1042 is approved and pending approvals drops to 11.',
  },
];

export async function generateNarration(
  steps: KaneStep[],
  demoTitle: string = 'Ledgerly Invoice Approval',
  sceneCount: number = 6
): Promise<SceneNarration[]> {
  const apiKey = process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return DEFAULT_NARRATIONS.slice(0, sceneCount);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

  const prompt = `
You are the Scriptwriter & Demo Director for Autocast AI.
Write captions and narration for a ${sceneCount}-scene demo of this exact app. Use the product's own words.

Demo Title: "${demoTitle}"
Scene Breakdown:
1. Hook. Pending list: 12 invoices waiting, including INV-1042 Apex Cloud Infra $4,850.00.
2. Reveal. Open INV-1042. Drawer shows Production Kubernetes Cluster and Multi-AZ Database transfer, due Nov 24.
3. Highlight. Three line items total $4,850.00.
4. Highlight. Click Approve Invoice, enter confirmation note, click Confirm.
5. Highlight. A green seal stamps in reading "APPROVED". This is the check Kane must see.
6. Punchline. The row flips to Approved, toast appears, and pending approvals drops from 12 to 11.

Rules:
1. Provide exactly ${sceneCount} scene items.
2. "caption": 2-5 words a viewer can read in under a second. Use invoice ids and button labels, not slogans.
3. "narration": 8 to 12 words. Present tense. Name INV-1042, Apex Cloud, Approve Invoice, or the Approved seal when that scene shows them.
4. Scene 1 is the hook. The last scene is the punchline. Do not say "now we click".
5. Banned words: streamline, visibility, seamlessly, enterprise-grade, leverage, unlock, centralized.

Output JSON ONLY in this format:
[
  {
    "stepIndex": 1,
    "caption": "Short Title",
    "narration": "Benefit-driven present tense sentence."
  }
]
`;

  try {
    const generatePromise = model.generateContent(prompt);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API timeout (4s)')), 4000)
    );
    const result = await Promise.race([generatePromise, timeoutPromise]);
    const text = result.response.text();
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed: SceneNarration[] = JSON.parse(cleanJson);
    if (Array.isArray(parsed) && parsed.length >= sceneCount) {
      return parsed.slice(0, sceneCount);
    }
    return DEFAULT_NARRATIONS.slice(0, sceneCount);
  } catch (err) {
    console.warn('Gemini narration generation failed, using polished fallback script:', err);
    return DEFAULT_NARRATIONS.slice(0, sceneCount);
  }
}
