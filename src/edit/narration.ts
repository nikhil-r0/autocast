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
    caption: 'Three invoices waiting',
    narration: 'INV-1001 from Acme is pending. Two more sit behind it.',
  },
  {
    stepIndex: 2,
    caption: 'Open INV-1001',
    narration: 'The drawer lists Cloud Infrastructure, SSL testing, due Nov 24.',
  },
  {
    stepIndex: 3,
    caption: 'Acme, $4,850.00',
    narration: "Acme's bill is $4,850.00 for architecture hours and SSL testing.",
  },
  {
    stepIndex: 4,
    caption: 'Approve Invoice',
    narration: 'Approve Invoice. Kane checks the green seal before a video exists.',
  },
  {
    stepIndex: 5,
    caption: 'Approved seal',
    narration: 'The green Approved seal is the sign-off. No seal, no demo.',
  },
  {
    stepIndex: 6,
    caption: 'INV-1001 is Approved',
    narration: 'INV-1001 flips to Approved. The pending count drops.',
  },
];

export async function generateNarration(
  steps: KaneStep[],
  demoTitle: string = 'Invoice Approval Workflow',
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
1. Hook. Pending list: INV-1001 Acme $4,850.00, plus INV-1002 and INV-1003.
2. Reveal. Open INV-1001. Drawer shows Cloud Infrastructure Architecture and Automated Penetration & SSL Testing, due Nov 24.
3. Highlight. Line items total $4,850.00.
4. Highlight. The button label is "Approve Invoice".
5. Highlight. A green seal reads "Approved". This is the check Kane must see.
6. Punchline. The row flips to Approved and the pending count drops.

Rules:
1. Provide exactly ${sceneCount} scene items.
2. "caption": 2-5 words a viewer can read in under a second. Use invoice ids and button labels, not slogans.
3. "narration": 8 to 12 words. Present tense. Name INV-1001, Acme, Approve Invoice, or the Approved seal when that scene shows them.
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
    const result = await model.generateContent(prompt);
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
