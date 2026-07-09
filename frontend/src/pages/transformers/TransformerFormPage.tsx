import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Wand2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { getApiErrorMessage, notifyApiError } from '../../api/http';
import { referenceDataApi } from '../../api/referenceDataApi';
import { transformerApi, TransformerMutationPayload } from '../../api/transformerApi';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { ReferenceItem, Transformer } from '../../types/api';
import { formatDate, getTransformerName } from '../../utils/format';

const statusOptions = ['Active', 'Faulty', 'Under Maintenance', 'Decommissioned', 'Unverified'];
const voltageOptions = [11, 33];
const fallbackRatingOptions = [50, 100, 160, 200, 250, 315, 500, 630, 1000];
const gpsMethodOptions = ['Field Captured', 'Imported', 'Estimated'] as const;
const secondaryVoltageOptions = ['415V', '240V', 'Other'] as const;
const phaseOptions = ['Single Phase', 'Three Phase'] as const;
const coolingOptions = ['ONAN', 'ONAF', 'OFAF'] as const;
const mountingOptions = ['Pole Mounted', 'Plinth', 'Ground', 'Indoor Substation'] as const;

const optionalText = (max: number, label: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max, `${label} must be ${max} characters or less`).optional()
  );

const optionalNumber = (label: string, min?: number, max?: number) =>
  z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? undefined : Number(value)),
    z
      .number({ invalid_type_error: `${label} must be a number` })
      .refine((value) => min === undefined || value >= min, `${label} must be at least ${min}`)
      .refine((value) => max === undefined || value <= max, `${label} must be ${max} or less`)
      .optional()
  );

const requiredNumber = (label: string, min?: number, max?: number) =>
  z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? NaN : Number(value)),
    z
      .number({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
      .refine((value) => Number.isFinite(value), `${label} is required`)
      .refine((value) => min === undefined || value >= min, `${label} must be at least ${min}`)
      .refine((value) => max === undefined || value <= max, `${label} must be ${max} or less`)
  );

const optionalPastDate = (label: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z
      .string()
      .refine((value) => !Number.isNaN(new Date(value).getTime()), `${label} must be a valid date`)
      .refine((value) => new Date(value).getTime() <= Date.now(), `${label} cannot be in the future`)
      .optional()
  );

const transformerFormSchema = z.object({
  manufacturer: z.string().trim().min(1, 'Manufacturer is required').max(100, 'Manufacturer must be 100 characters or less'),
  serial_number: optionalText(50, 'Serial number'),
  year_manufactured: optionalNumber('Year manufactured', 1900, new Date().getFullYear()),
  uedcl_reference: optionalText(50, 'UEDCL reference'),
  kva_rating: z.preprocess(
    (value) => Number(value),
    z.number().refine((value) => fallbackRatingOptions.includes(value), 'Select a supported kVA rating')
  ),
  network_voltage_kv: z.preprocess(
    (value) => Number(value),
    z.number().refine((value) => voltageOptions.includes(value), 'Select a supported network voltage')
  ),
  voltage_secondary: z.enum(secondaryVoltageOptions),
  phase_type: z.enum(phaseOptions),
  cooling_type: z.enum(coolingOptions),
  mounting_type: z.enum(mountingOptions),
  vector_group: optionalText(10, 'Vector group'),
  territory_id: z.string().trim().min(1, 'Territory is required'),
  service_area_id: optionalText(80, 'Service area'),
  feeder_id: optionalText(80, 'Feeder'),
  feeder_name: optionalText(100, 'Feeder name'),
  feeder_code: optionalText(20, 'Feeder code'),
  substation_name: optionalText(100, 'Substation name'),
  district_id: z.string().trim().min(1, 'District is required'),
  sub_county: optionalText(100, 'Sub-county'),
  parish: optionalText(100, 'Parish'),
  village: optionalText(100, 'Village'),
  site_name: z.string().trim().min(1, 'Site name is required').max(200, 'Site name must be 200 characters or less'),
  latitude: requiredNumber('Latitude', -90, 90),
  longitude: requiredNumber('Longitude', -180, 180),
  gps_method: z.enum(gpsMethodOptions),
  gps_accuracy: optionalNumber('GPS accuracy', 0),
  install_date: optionalPastDate('Installation date'),
  installing_contractor: optionalText(100, 'Installing contractor'),
  commissioned_by: optionalText(100, 'Commissioned by'),
  commissioning_date: optionalPastDate('Commissioning date'),
  warranty_expiry: optionalPastDate('Warranty expiry')
});

type TransformerFormValues = z.infer<typeof transformerFormSchema>;

const defaultValues: TransformerFormValues = {
  manufacturer: '',
  serial_number: '',
  year_manufactured: undefined,
  uedcl_reference: '',
  kva_rating: 100,
  network_voltage_kv: 11,
  voltage_secondary: '415V',
  phase_type: 'Three Phase',
  cooling_type: 'ONAN',
  mounting_type: 'Pole Mounted',
  vector_group: '',
  territory_id: '',
  service_area_id: '',
  feeder_id: '',
  feeder_name: '',
  feeder_code: '',
  substation_name: '',
  district_id: '',
  sub_county: '',
  parish: '',
  village: '',
  site_name: '',
  latitude: 0,
  longitude: 0,
  gps_method: 'Field Captured',
  gps_accuracy: undefined,
  install_date: '',
  installing_contractor: '',
  commissioned_by: '',
  commissioning_date: '',
  warranty_expiry: ''
};

function refId(value?: string | { _id?: string }) {
  if (!value) return '';
  return typeof value === 'string' ? value : value._id || '';
}

function isoDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function valuesFromTransformer(item: Transformer): TransformerFormValues {
  const coordinates = item.gps?.coordinates ?? [];
  return {
    manufacturer: item.manufacturer ?? '',
    serial_number: item.serial_number ?? '',
    year_manufactured: item.year_manufactured,
    uedcl_reference: item.uedcl_reference ?? '',
    kva_rating: item.kva_rating ?? 100,
    network_voltage_kv: item.network_voltage_kv ?? 11,
    voltage_secondary: (item.voltage_secondary as TransformerFormValues['voltage_secondary']) || '415V',
    phase_type: (item.phase_type as TransformerFormValues['phase_type']) || 'Three Phase',
    cooling_type: (item.cooling_type as TransformerFormValues['cooling_type']) || 'ONAN',
    mounting_type: (item.mounting_type as TransformerFormValues['mounting_type']) || 'Pole Mounted',
    vector_group: item.vector_group ?? '',
    territory_id: refId(item.location_operational?.territory_id),
    service_area_id: refId(item.location_operational?.service_area_id),
    feeder_id: refId(item.location_operational?.feeder_id),
    feeder_name: item.location_operational?.feeder_name ?? '',
    feeder_code: item.location_operational?.feeder_code ?? '',
    substation_name: item.location_operational?.substation_name ?? '',
    district_id: item.location_administrative?.district_id ?? '',
    sub_county: item.location_administrative?.sub_county ?? '',
    parish: item.location_administrative?.parish ?? '',
    village: item.location_administrative?.village ?? '',
    site_name: item.location_administrative?.site_name ?? item.site_name ?? '',
    latitude: coordinates[1] ?? 0,
    longitude: coordinates[0] ?? 0,
    gps_method: (item.gps?.method as TransformerFormValues['gps_method']) || 'Field Captured',
    gps_accuracy: item.gps?.accuracy_metres,
    install_date: isoDate(item.installation?.install_date),
    installing_contractor: item.installation?.installing_contractor ?? '',
    commissioned_by: item.installation?.commissioned_by ?? '',
    commissioning_date: isoDate(item.installation?.commissioning_date),
    warranty_expiry: isoDate(item.installation?.warranty_expiry)
  };
}

function cleanPayload(values: TransformerFormValues): TransformerMutationPayload {
  const payload = { ...values, feeder_code: values.feeder_code?.toUpperCase() } as TransformerMutationPayload;
  Object.entries(payload).forEach(([key, value]) => {
    if (value === '' || value === undefined || value === null) {
      delete payload[key as keyof TransformerMutationPayload];
    }
  });
  return payload;
}

function optionLabel(item: ReferenceItem) {
  const parts = [item.name, item.code].filter(Boolean);
  if (typeof item.kva === 'number' || typeof item.network_voltage_kv === 'number') {
    return `${item.kva ?? ''} kVA${item.network_voltage_kv ? ` / ${item.network_voltage_kv} kV` : ''}`.trim();
  }
  return parts.length > 0 ? parts.join(' / ') : item._id;
}

function referenceError(...errors: unknown[]) {
  return errors.find(Boolean);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="field-error">{message}</span>;
}

function ReferenceSelect({
  label,
  placeholder,
  items,
  isLoading,
  error,
  registration,
  required
}: {
  label: string;
  placeholder: string;
  items?: ReferenceItem[];
  isLoading: boolean;
  error: unknown;
  registration: UseFormRegisterReturn;
  required?: boolean;
}) {
  const rows = items ?? [];
  return (
    <label>
      <span>{label}</span>
      <select disabled={isLoading || Boolean(error) || rows.length === 0} {...registration}>
        <option value="">{isLoading ? `Loading ${label.toLowerCase()}` : rows.length === 0 ? `No ${label.toLowerCase()} available` : placeholder}</option>
        {rows.map((item) => (
          <option value={item._id} key={item._id}>{optionLabel(item)}</option>
        ))}
      </select>
      {required && rows.length === 0 && !isLoading && !error && <small>No records are available for this required field.</small>}
      {Boolean(error) && <small>Could not load {label.toLowerCase()}.</small>}
    </label>
  );
}

function invalidateTransformerWork(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  void queryClient.invalidateQueries({ queryKey: ['transformers'] });
  void queryClient.invalidateQueries({ queryKey: ['faults', 'open'] });
  void queryClient.invalidateQueries({ queryKey: ['inspections', 'overdue'] });
  void queryClient.invalidateQueries({ queryKey: ['maintenance', 'upcoming'] });
  if (id) {
    void queryClient.invalidateQueries({ queryKey: ['transformers', id] });
    void queryClient.invalidateQueries({ queryKey: ['transformers', id, 'timeline'] });
    void queryClient.invalidateQueries({ queryKey: ['transformers', id, 'qr'] });
  }
}

export function TransformerFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = mode === 'edit';

  const form = useForm<TransformerFormValues>({
    resolver: zodResolver(transformerFormSchema),
    defaultValues
  });
  const { register, handleSubmit, reset, formState } = form;

  const transformerQuery = useQuery({
    queryKey: ['transformers', id],
    queryFn: () => transformerApi.getById(id ?? ''),
    enabled: isEdit && Boolean(id)
  });

  const territories = useQuery({ queryKey: ['reference-data', 'territories'], queryFn: referenceDataApi.territories });
  const serviceAreas = useQuery({ queryKey: ['reference-data', 'service-areas'], queryFn: referenceDataApi.serviceAreas });
  const feeders = useQuery({ queryKey: ['reference-data', 'feeders'], queryFn: referenceDataApi.feeders });
  const districts = useQuery({ queryKey: ['reference-data', 'districts'], queryFn: referenceDataApi.districts });
  const ratings = useQuery({ queryKey: ['reference-data', 'ratings'], queryFn: referenceDataApi.ratings });

  useEffect(() => {
    if (isEdit && transformerQuery.data) reset(valuesFromTransformer(transformerQuery.data));
    if (!isEdit) reset(defaultValues);
  }, [isEdit, reset, transformerQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: TransformerMutationPayload) => transformerApi.create(payload),
    onSuccess: (transformer) => {
      invalidateTransformerWork(queryClient, transformer._id);
      toast.success('Transformer created');
      navigate(`/transformers/${transformer._id}`);
    },
    onError: notifyApiError
  });

  const updateMutation = useMutation({
    mutationFn: (payload: TransformerMutationPayload) => transformerApi.update(id ?? '', payload),
    onSuccess: (transformer) => {
      invalidateTransformerWork(queryClient, transformer._id);
      toast.success('Transformer updated');
      navigate(`/transformers/${transformer._id}`);
    },
    onError: notifyApiError
  });

  const ratingOptions = useMemo(() => {
    const fromReference = (ratings.data ?? [])
      .map((item) => item.kva)
      .filter((value): value is number => typeof value === 'number' && fallbackRatingOptions.includes(value));
    return Array.from(new Set([...fromReference, ...fallbackRatingOptions])).sort((left, right) => left - right);
  }, [ratings.data]);

  const saving = createMutation.isPending || updateMutation.isPending;
  const item = transformerQuery.data;
  const referenceLoadError = referenceError(territories.error, serviceAreas.error, feeders.error, districts.error, ratings.error);
  const mutationError = createMutation.error || updateMutation.error;

  const onSubmit = (values: TransformerFormValues) => {
    const payload = cleanPayload(values);
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  if (isEdit && !id) return <ErrorState error={new Error('Missing transformer id')} title="Transformer unavailable" />;
  if (isEdit && transformerQuery.isLoading) return <Loading label="Loading transformer for editing" />;
  if (isEdit && transformerQuery.error) return <ErrorState error={transformerQuery.error} title="Transformer unavailable" />;

  return (
    <div className="page-stack form-page">
      <section className="detail-hero form-hero">
        <div>
          <Link className="back-link" to={isEdit && id ? `/transformers/${id}` : '/transformers'}>
            <ArrowLeft size={16} />
            <span>{isEdit ? 'Back to Detail' : 'Back to Registry'}</span>
          </Link>
          <div className="detail-title-row">
            <div>
              <h1>{isEdit ? `Edit ${getTransformerName(item)}` : 'New Transformer'}</h1>
              <p>{isEdit ? 'Update registry details for this transformer.' : 'Register a transformer in the asset registry.'}</p>
            </div>
            <div className="detail-badge-row">
              <span className="badge">{isEdit ? item?.operational_status || 'Status not recorded' : 'Status assigned after registration'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="status-strip">
        <div>
          <Wand2 size={18} />
          <span>Asset ID</span>
        </div>
        <small>{isEdit ? getTransformerName(item) : 'Generated by the registry after save'}</small>
      </section>

      {referenceLoadError ? <ErrorState error={referenceLoadError} title="Some reference data is unavailable" /> : null}

      <form className="panel transformer-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="panel-heading">
          <h2>Transformer details</h2>
          <button className="primary-button" type="submit" disabled={saving}>
            <Save size={16} />
            <span>{saving ? 'Saving' : isEdit ? 'Save Changes' : 'Create Transformer'}</span>
          </button>
        </div>

        {mutationError ? <div className="form-error" role="alert">{getApiErrorMessage(mutationError)}</div> : null}

        <section className="form-section">
          <h3>Identity</h3>
          <div className="form-grid">
            <label>
              <span>Manufacturer</span>
              <input autoComplete="off" {...register('manufacturer')} />
              <FieldError message={formState.errors.manufacturer?.message} />
            </label>
            <label>
              <span>Serial Number</span>
              <input autoComplete="off" {...register('serial_number')} />
              <FieldError message={formState.errors.serial_number?.message} />
            </label>
            <label>
              <span>Year Manufactured</span>
              <input type="number" min="1900" max={new Date().getFullYear()} {...register('year_manufactured')} />
              <FieldError message={formState.errors.year_manufactured?.message} />
            </label>
            <label>
              <span>UEDCL Reference</span>
              <input autoComplete="off" {...register('uedcl_reference')} />
              <FieldError message={formState.errors.uedcl_reference?.message} />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h3>Electrical profile</h3>
          <div className="form-grid">
            <label>
              <span>kVA Rating</span>
              <select {...register('kva_rating')}>
                {ratingOptions.map((value) => (
                  <option value={value} key={value}>{value} kVA</option>
                ))}
              </select>
              <FieldError message={formState.errors.kva_rating?.message} />
            </label>
            <label>
              <span>Network Voltage</span>
              <select {...register('network_voltage_kv')}>
                {voltageOptions.map((value) => (
                  <option value={value} key={value}>{value} kV</option>
                ))}
              </select>
              <FieldError message={formState.errors.network_voltage_kv?.message} />
            </label>
            <label>
              <span>Secondary Voltage</span>
              <select {...register('voltage_secondary')}>
                {secondaryVoltageOptions.map((value) => (
                  <option value={value} key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Phase Type</span>
              <select {...register('phase_type')}>
                {phaseOptions.map((value) => (
                  <option value={value} key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Cooling Type</span>
              <select {...register('cooling_type')}>
                {coolingOptions.map((value) => (
                  <option value={value} key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Mounting Type</span>
              <select {...register('mounting_type')}>
                {mountingOptions.map((value) => (
                  <option value={value} key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Vector Group</span>
              <input autoComplete="off" {...register('vector_group')} />
              <FieldError message={formState.errors.vector_group?.message} />
            </label>
            <label>
              <span>Operational Status</span>
              <select value={item?.operational_status ?? 'Unverified'} disabled>
                {statusOptions.map((value) => (
                  <option value={value} key={value}>{value}</option>
                ))}
              </select>
              <small>{isEdit ? 'Managed by operational workflows.' : 'New records start as unverified until verified.'}</small>
            </label>
          </div>
        </section>

        <section className="form-section">
          <h3>Location</h3>
          <div className="form-grid">
            <label>
              <span>Site Name</span>
              <input autoComplete="off" {...register('site_name')} />
              <FieldError message={formState.errors.site_name?.message} />
            </label>
            <ReferenceSelect label="District" placeholder="Select district" items={districts.data} isLoading={districts.isLoading} error={districts.error} registration={register('district_id')} required />
            <FieldError message={formState.errors.district_id?.message} />
            <ReferenceSelect label="Territory" placeholder="Select territory" items={territories.data} isLoading={territories.isLoading} error={territories.error} registration={register('territory_id')} required />
            <FieldError message={formState.errors.territory_id?.message} />
            <ReferenceSelect label="Service Area" placeholder="Select service area" items={serviceAreas.data} isLoading={serviceAreas.isLoading} error={serviceAreas.error} registration={register('service_area_id')} />
            <ReferenceSelect label="Feeder" placeholder="Select feeder" items={feeders.data} isLoading={feeders.isLoading} error={feeders.error} registration={register('feeder_id')} />
            <label>
              <span>Feeder Name</span>
              <input autoComplete="off" {...register('feeder_name')} />
              <FieldError message={formState.errors.feeder_name?.message} />
            </label>
            <label>
              <span>Feeder Code</span>
              <input autoComplete="off" {...register('feeder_code')} />
              <FieldError message={formState.errors.feeder_code?.message} />
            </label>
            <label>
              <span>Substation</span>
              <input autoComplete="off" {...register('substation_name')} />
              <FieldError message={formState.errors.substation_name?.message} />
            </label>
            <label>
              <span>Sub-county</span>
              <input autoComplete="off" {...register('sub_county')} />
              <FieldError message={formState.errors.sub_county?.message} />
            </label>
            <label>
              <span>Parish</span>
              <input autoComplete="off" {...register('parish')} />
              <FieldError message={formState.errors.parish?.message} />
            </label>
            <label>
              <span>Village</span>
              <input autoComplete="off" {...register('village')} />
              <FieldError message={formState.errors.village?.message} />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h3>GPS and installation</h3>
          <div className="form-grid">
            <label>
              <span>Latitude</span>
              <input type="number" step="any" {...register('latitude')} />
              <FieldError message={formState.errors.latitude?.message} />
            </label>
            <label>
              <span>Longitude</span>
              <input type="number" step="any" {...register('longitude')} />
              <FieldError message={formState.errors.longitude?.message} />
            </label>
            <label>
              <span>GPS Method</span>
              <select {...register('gps_method')}>
                {gpsMethodOptions.map((value) => (
                  <option value={value} key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span>GPS Accuracy (metres)</span>
              <input type="number" min="0" step="any" {...register('gps_accuracy')} />
              <FieldError message={formState.errors.gps_accuracy?.message} />
            </label>
            <label>
              <span>Installation Date</span>
              <input type="date" max={new Date().toISOString().slice(0, 10)} {...register('install_date')} />
              <FieldError message={formState.errors.install_date?.message} />
            </label>
            <label>
              <span>Installing Contractor</span>
              <input autoComplete="off" {...register('installing_contractor')} />
              <FieldError message={formState.errors.installing_contractor?.message} />
            </label>
            <label>
              <span>Commissioned By</span>
              <input autoComplete="off" {...register('commissioned_by')} />
              <FieldError message={formState.errors.commissioned_by?.message} />
            </label>
            <label>
              <span>Commissioning Date</span>
              <input type="date" max={new Date().toISOString().slice(0, 10)} {...register('commissioning_date')} />
              <FieldError message={formState.errors.commissioning_date?.message} />
            </label>
            <label>
              <span>Warranty Expiry</span>
              <input type="date" max={new Date().toISOString().slice(0, 10)} {...register('warranty_expiry')} />
              <FieldError message={formState.errors.warranty_expiry?.message} />
            </label>
          </div>
        </section>

        <div className="form-footer">
          <span>{isEdit && item?.updated_at ? `Last updated ${formatDate(item.updated_at)}` : 'Review required fields before saving.'}</span>
          <button className="primary-button" type="submit" disabled={saving}>
            <Save size={16} />
            <span>{saving ? 'Saving' : isEdit ? 'Save Changes' : 'Create Transformer'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
