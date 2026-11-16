import { Invoice, Metrics, Vendor } from '../types.js';
import {
  DEMO_CLOCK as _DEMO_CLOCK,
  SEED_VENDORS as _SEED_VENDORS,
  INITIAL_METRICS as _INITIAL_METRICS,
  SEED_INVOICES as _SEED_INVOICES,
} from '../../server/seedData.js';

export const DEMO_CLOCK: string = _DEMO_CLOCK;
export const SEED_VENDORS: Vendor[] = _SEED_VENDORS as Vendor[];
export const INITIAL_METRICS: Metrics = _INITIAL_METRICS as Metrics;
export const SEED_INVOICES: Invoice[] = _SEED_INVOICES as Invoice[];
