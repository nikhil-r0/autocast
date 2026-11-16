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
    caption: 'Accounts Payable Dashboard',
    narration: 'Gain complete real-time visibility over vendor disbursements, pending authorizations, and processing SLAs in one centralized view.',
  },
  {
    stepIndex: 2,
    caption: 'Select Invoice for Review',
    narration: 'Instantly surface flagged disbursements and initiate structured compliance reviews with a single click.',
  },
  {
    stepIndex: 3,
    caption: 'Verify Line Items & Terms',
    narration: 'Thoroughly audit itemized infrastructure fees, net payment terms, and vendor billing contracts prior to disbursement.',
  },
  {
    stepIndex: 4,
    caption: 'Authorize Disbursement',
    narration: 'Release payments instantly to maintain vendor trust while enforcing corporate spending controls.',
  },
  {
    stepIndex: 5,
    caption: 'Verified Digital Seal',
    narration: 'A cryptographic approval seal confirms authorized signoff and locks the immutable audit trail.',
  },
  {
    stepIndex: 6,
    caption: 'Reconciled Ledger Update',
    narration: 'Reconcile the accounts payable register immediately, synchronizing company books and SLA metrics.',
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
Write punchy, professional, benefit-driven captions and voiceover narration for a ${sceneCount}-scene demo video.

Demo Title: "${demoTitle}"
Scene Breakdown:
1. Central accounts payable dashboard overview showing pending invoices and metrics.
2. Clicking invoice INV-1001 "Review Invoice" to open the review drawer.
3. Reviewing itemized charges and payment terms in the drawer.
4. Clicking "Approve Invoice" to authorize disbursement.
5. Verifying the green "Approved" seal stamp with director signoff.
6. Dismissing the modal to show the updated table with approved status and reconciled ledger.

Rules:
1. Provide exactly ${sceneCount} scene items.
2. "caption": A concise UI sidebar label (3-6 words, title case, e.g. "Select Invoice for Review", "Authorize Disbursement").
3. "narration": 12 to 18 words per scene. Present tense, benefit first. NEVER say "Now we click" or "Here the user clicks". State the user benefit and system outcome.

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
