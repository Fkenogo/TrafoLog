import { Fault, Transformer, User } from '../../types/api';
import { getTransformerName } from '../../utils/format';

export const faultTypeOptions = [
  'Overload',
  'Oil Leak',
  'Bushing Failure',
  'Winding Failure',
  'Complete Failure',
  'Fire',
  'Theft',
  'Vandalism',
  'LV Side Fault',
  'HV Side Fault',
  'Other'
] as const;

export const severityOptions = ['Minor', 'Major', 'Critical', 'Complete Outage'] as const;
export const statusOptions = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'] as const;
export const sourceOptions = ['Field Observation', 'Customer Report', 'Supervisor'] as const;
export const priorityOptions = ['Normal', 'High', 'Urgent'] as const;

export function asTransformer(value?: string | Transformer) {
  return typeof value === 'object' ? value : undefined;
}

export function refId(value?: string | { _id?: string }) {
  if (!value) return '';
  return typeof value === 'string' ? value : value._id || '';
}

export function userName(value?: string | User) {
  if (!value) return 'Not assigned';
  return typeof value === 'string' ? 'Assigned user' : value.name || value.email || 'Assigned user';
}

export function readable(value?: string | number | boolean | null) {
  if (value === undefined || value === null || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function faultLabel(item?: Fault) {
  if (!item) return 'Fault';
  return `FLT-${item._id.slice(-6).toUpperCase()}`;
}

export function faultTransformerName(item?: Fault) {
  return getTransformerName(item?.transformer_id);
}

export function transformerSite(value?: string | Transformer) {
  const transformer = asTransformer(value);
  return transformer?.location_administrative?.site_name || transformer?.site_name || 'Not recorded';
}

export function transformerTerritory(value?: string | Transformer) {
  const transformer = asTransformer(value);
  const territory = transformer?.location_operational?.territory_id;
  if (!territory) return transformer?.location_operational?.territory_name || 'Not recorded';
  return typeof territory === 'string' ? territory : territory.name || territory.code || 'Not recorded';
}

export function transformerServiceArea(value?: string | Transformer) {
  const transformer = asTransformer(value);
  const serviceArea = transformer?.location_operational?.service_area_id;
  if (!serviceArea) return transformer?.location_operational?.service_area_name || 'Not recorded';
  return typeof serviceArea === 'string' ? serviceArea : serviceArea.name || serviceArea._id || 'Not recorded';
}

export function severityBadgeClass(value?: string) {
  if (value === 'Complete Outage' || value === 'Critical') return 'condition-badge condition-critical';
  if (value === 'Major') return 'condition-badge condition-poor';
  if (value === 'Minor') return 'condition-badge condition-fair';
  return 'badge';
}

export function faultStatusBadgeClass(value?: string) {
  if (value === 'Closed') return 'condition-badge condition-good';
  if (value === 'Resolved') return 'condition-badge condition-fair';
  if (value === 'In Progress' || value === 'Assigned') return 'condition-badge condition-poor';
  if (value === 'Open') return 'condition-badge condition-critical';
  return 'badge';
}

export function displayFaultStatus(value?: string) {
  if (value === 'Open') return 'Reported';
  if (value === 'Resolved') return 'Awaiting Verification';
  return value || 'Reported';
}

export function nextLifecycleAction(status?: string) {
  if (status === 'Open') return 'assign';
  if (status === 'Assigned') return 'start';
  if (status === 'In Progress') return 'resolve';
  if (status === 'Resolved') return 'close';
  return null;
}
