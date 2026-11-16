import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import dns from 'dns';

// Ensure IPv4 first to avoid IPv6 timeout delay
dns.setDefaultResultOrder('ipv4first');
dotenv.config();

export interface FrozenClaim {
  id: string;
  claim: string;
  expectedAssertion: string;
  verified?: boolean;
}

export interface ObjectivePlan {
  title: string;
  objective: string;
  expectedVerification: string;
  frozenClaims: FrozenClaim[];
}

export async function generateKaneObjective(
  userPrompt: string,
  appUrl: string = 'http://localhost:8080',
  existingClaims?: FrozenClaim[]
): Promise<ObjectivePlan> {
  const apiKey = process.env.GEMINI_API_KEY || '';

  const defaultClaims: FrozenClaim[] = [
    {
      id: 'claim-1',
      claim: 'Invoice approved in 3 clicks',
      expectedAssertion: 'Approved seal is visible',
    },
    {
      id: 'claim-2',
      claim: 'Ledger balance reconciled: $4,850.00',
      expectedAssertion: 'Line items total $4,850.00',
    },
  ];

  const frozenClaims = existingClaims && existingClaims.length > 0 ? existingClaims : defaultClaims;

  if (!apiKey) {
    return {
      title: 'Ledgerly Invoice Approval',
      objective: 'Click the Review button for row INV-1042, click Approve Invoice, enter approval note, click Confirm, then verify Approved seal is visible',
      expectedVerification: frozenClaims[0].expectedAssertion,
      frozenClaims,
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

  const prompt = `
You are the AI Director for Autocast AI, an autonomous product demo video generator.
Your job is to translate a high-level user request into a precise, step-by-step Kane CLI browser automation objective.

CRITICAL INTEGRITY RULES:
1. Frozen Claims: You CANNOT weaken, alter, or remove the core verification assertion.
   Required Assertion: "${frozenClaims[0].expectedAssertion}"
2. Kane drives a real browser with natural language and computer vision.
3. The objective must state the sequential actions (clicks, inputs, navigations).
4. The objective MUST conclude with the verbatim assertion: "then verify ${frozenClaims[0].expectedAssertion}".
5. Keep it direct and concise (under 2 sentences).

Target App Start URL: ${appUrl}
Bundled App Features (Ledgerly SaaS):
- Pending Invoices table (e.g. INV-1042 Apex Cloud Infra $4,850.00).
- Each invoice row has an individual "Review" button on the right side that slides open the invoice drawer. Do not select checkboxes or use bulk actions.
- Clicking "Approve Invoice" in the drawer opens a confirmation modal.
- Entering an authorization note in the textarea and clicking "Confirm Approval" stamps the green "Approved" seal into document preview.

User Request: "${userPrompt}"

Return JSON ONLY in this format:
{
  "title": "Short title for the video (e.g. Ledgerly Invoice Approval)",
  "objective": "Click the Review button for row INV-1042, click Approve Invoice in the drawer, enter approval note, click Confirm Approval, then verify Approved seal is visible"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    let finalObjective = parsed.objective || '';
    // Enforce frozen assertion guarantee: append if missing
    if (!finalObjective.toLowerCase().includes(frozenClaims[0].expectedAssertion.toLowerCase())) {
      finalObjective = `${finalObjective.replace(/\.?$/, '')}, then verify ${frozenClaims[0].expectedAssertion}`;
    }

    return {
      title: parsed.title || 'Product Demo',
      objective: finalObjective,
      expectedVerification: frozenClaims[0].expectedAssertion,
      frozenClaims,
    };
  } catch (error) {
    console.warn('Gemini objective generation failed, using fallback:', error);
    return {
      title: 'Ledgerly Invoice Approval',
      objective: `Click the Review button for row INV-1042, click Approve Invoice in the drawer, enter approval note, click Confirm Approval, then verify ${frozenClaims[0].expectedAssertion}`,
      expectedVerification: frozenClaims[0].expectedAssertion,
      frozenClaims,
    };
  }
}
