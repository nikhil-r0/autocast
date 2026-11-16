export type InvoiceStatus = 'Pending' | 'Approved' | 'Rejected' | 'Payment failed';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string; // e.g. "INV-1042"
  vendor: string;
  vendorCategory: string;
  amount: number;
  issueDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  status: InvoiceStatus;
  lineItems: LineItem[];
  department: string;
  approvalNote?: string;
  approvedAt?: string;
  paymentError?: string;
}

export interface Metrics {
  pendingApprovals: number;
  pendingAmount: number;
  approvedThisMonth: number;
  avgProcessingHours: number;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
}
