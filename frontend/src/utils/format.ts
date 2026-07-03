export const formatDate = (value?: string) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(date);
};

export const getTransformerName = (transformer?: unknown) => {
  if (!transformer || typeof transformer !== 'object') return 'Transformer';
  const item = transformer as { asset_id?: string; site_name?: string; location_administrative?: { site_name?: string } };
  return item.asset_id || item.site_name || item.location_administrative?.site_name || 'Transformer';
};

export const asCount = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
