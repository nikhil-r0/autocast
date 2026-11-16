import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import dns from 'dns';

// Ensure IPv4 first to avoid IPv6 timeout delay
dns.setDefaultResultOrder('ipv4first');
dotenv.config();

export interface ObjectivePlan {
  title: string;
  objective: string;
  expectedVerification: string;
}

export async function generateKaneObjective(
  userPrompt: string,
  appUrl: string = 'http://localhost:8080'
): Promise<ObjectivePlan> {
  const apiKey = process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return {
      title: 'Invoice Approval Workflow',
      objective: 'Click the first invoice INV-1001, click the Approve Invoice button, then verify the Approved seal is visible',
      expectedVerification: 'the Approved seal is visible',
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

  const prompt = `
You are the AI Director for Autocast AI, an autonomous product demo video generator.
Your job is to translate a high-level user request into a precise, step-by-step Kane CLI browser automation objective.

Rules for Kane CLI objectives:
1. Kane drives a real browser with natural language and computer vision.
2. The objective must state the sequential actions (clicks, inputs, navigations).
3. The objective MUST end with an explicit visual assertion ("then verify the <element> is visible" or "verify <text> appears"). This guarantees that the demo proves the feature works before any video is rendered.
4. Keep it direct and concise (under 2 sentences).

Target App Start URL: ${appUrl}
Bundled App Features:
- Pending Invoices table (e.g. INV-1001 Acme Corp, INV-1002 Stark Dynamics).
- Clicking an invoice or its "Review Invoice" button opens a review dialog.
- Clicking "Approve Invoice" marks it approved and displays an "Approved" seal badge.

User Request: "${userPrompt}"

Return JSON ONLY in this format:
{
  "title": "Short title for the video (e.g. Invoice Approval Workflow)",
  "objective": "Click the first invoice INV-1001, click the Approve Invoice button, then verify the Approved seal is visible",
  "expectedVerification": "the Approved seal is visible"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      title: parsed.title || 'Product Demo',
      objective: parsed.objective,
      expectedVerification: parsed.expectedVerification || 'feature verification',
    };
  } catch (error) {
    console.warn('Gemini objective generation failed, using fallback:', error);
    return {
      title: 'Invoice Approval Workflow',
      objective: 'Click the first invoice INV-1001, click the Approve Invoice button, then verify the Approved seal is visible',
      expectedVerification: 'the Approved seal is visible',
    };
  }
}
