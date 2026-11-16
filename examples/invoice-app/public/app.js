const INVOICE_DATA = {
  'INV-1001': {
    id: 'INV-1001',
    vendor: 'Acme Corporation',
    issueDate: 'Nov 10, 2026',
    dueDate: 'Nov 24, 2026',
    amount: '$4,850.00',
    status: 'Pending',
    items: [
      { name: 'Cloud Infrastructure Architecture (40 hrs)', amount: '$3,800.00' },
      { name: 'Automated Penetration & SSL Testing', amount: '$1,050.00' }
    ]
  },
  'INV-1002': {
    id: 'INV-1002',
    vendor: 'Stark Dynamics',
    issueDate: 'Nov 12, 2026',
    dueDate: 'Nov 26, 2026',
    amount: '$12,400.00',
    status: 'Pending',
    items: [
      { name: 'H100 GPU Cluster Compute (120 hrs)', amount: '$10,200.00' },
      { name: 'NVLink Dedicated Interconnect', amount: '$2,200.00' }
    ]
  },
  'INV-1003': {
    id: 'INV-1003',
    vendor: 'Wayne Technologies',
    issueDate: 'Nov 01, 2026',
    dueDate: 'Nov 15, 2026',
    amount: '$8,200.00',
    status: 'Approved',
    items: [
      { name: 'SecOps 24/7 Endpoint Monitoring', amount: '$6,000.00' },
      { name: 'Compliance Incident Response SLA', amount: '$2,200.00' }
    ]
  }
};

let currentInvoiceId = null;

function isBrokenMode() {
  const params = new URLSearchParams(window.location.search);
  const brokenParam = params.get('broken');
  if (brokenParam === 'true' || brokenParam === 'approve') return true;
  if (window.__BROKEN_FLAG__ === 'approve' || window.__BROKEN_FLAG__ === 'true') return true;
  return false;
}

function openInvoice(id) {
  const inv = INVOICE_DATA[id];
  if (!inv) return;
  currentInvoiceId = id;

  document.getElementById('modal-inv-id').textContent = inv.id;
  document.getElementById('modal-vendor-name').textContent = inv.vendor;
  document.getElementById('modal-issue-date').textContent = inv.issueDate;
  document.getElementById('modal-due-date').textContent = inv.dueDate;
  document.getElementById('modal-total-amount').textContent = inv.amount;

  const itemsContainer = document.getElementById('modal-line-items');
  itemsContainer.innerHTML = inv.items.map(item => `
    <div class="line-item">
      <span>${item.name}</span>
      <span class="font-mono">${item.amount}</span>
    </div>
  `).join('');

  // Reset state
  document.getElementById('error-banner').style.display = 'none';
  const seal = document.getElementById('approval-seal');
  const approveBtn = document.getElementById('approve-invoice-btn');

  if (inv.status === 'Approved') {
    seal.style.display = 'flex';
    approveBtn.disabled = true;
    approveBtn.textContent = 'Already Approved';
  } else {
    seal.style.display = 'none';
    approveBtn.disabled = false;
    approveBtn.textContent = 'Approve Invoice';
  }

  document.getElementById('modal-overlay').classList.add('open');
}

function closeInvoice() {
  document.getElementById('modal-overlay').classList.remove('open');
  currentInvoiceId = null;
}

function approveCurrentInvoice() {
  if (!currentInvoiceId) return;

  const approveBtn = document.getElementById('approve-invoice-btn');
  const errorBanner = document.getElementById('error-banner');
  const seal = document.getElementById('approval-seal');

  // Centerpiece test: If broken mode is active, simulate product failure!
  if (isBrokenMode()) {
    console.error('System fault: approval transaction rejected by backend lock.');
    errorBanner.style.display = 'block';
    seal.style.display = 'none';
    return;
  }

  // Normal flow:
  errorBanner.style.display = 'none';
  seal.style.display = 'flex';
  document.getElementById('seal-timestamp').textContent = `Verified by Finance Director • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // Update data & table status pill
  INVOICE_DATA[currentInvoiceId].status = 'Approved';
  const tableStatusPill = document.getElementById(`status-${currentInvoiceId}`);
  if (tableStatusPill) {
    tableStatusPill.textContent = 'Approved';
    tableStatusPill.className = 'status-pill status-approved';
  }

  approveBtn.disabled = true;
  approveBtn.textContent = 'Approved';
}

// Close modal on Escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeInvoice();
});

// Update environment badge if broken mode is active
window.addEventListener('DOMContentLoaded', () => {
  if (isBrokenMode()) {
    const badge = document.getElementById('env-badge');
    if (badge) {
      badge.textContent = 'System: Chaos Mode (BROKEN=approve)';
      badge.style.color = '#ef4444';
      badge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      badge.style.background = 'rgba(239, 68, 68, 0.15)';
    }
  }
});
