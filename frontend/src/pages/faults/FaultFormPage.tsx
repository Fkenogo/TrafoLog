import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, ShieldAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { faultApi, FaultMutationPayload } from '../../api/faultApi';
import { getApiErrorMessage, notifyApiError } from '../../api/http';
import { inspectionApi } from '../../api/inspectionApi';
import { transformerApi } from '../../api/transformerApi';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { Fault, Transformer } from '../../types/api';
import { formatDate, getTransformerName } from '../../utils/format';
import { faultLabel, faultTypeOptions, refId, severityOptions, sourceOptions } from './faultHelpers';

const optionalText = (max: number, label: string) =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), z.string().trim().max(max, `${label} must be ${max} characters or less`).optional());

const optionalNumber = (label: string, min?: number) =>
  z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? undefined : Number(value)),
    z.number({ invalid_type_error: `${label} must be a number` }).refine((value) => min === undefined || value >= min, `${label} cannot be negative`).optional()
  );

const faultFormSchema = z.object({
  transformer_id: z.string().trim().min(1, 'Transformer is required'),
  inspection_id: optionalText(80, 'Inspection'),
  fault_date: z.string().min(1, 'Reported date is required').refine((value) => new Date(value).getTime() <= Date.now(), 'Reported date cannot be in the future'),
  fault_source: z.enum(sourceOptions),
  fault_type: z.enum(faultTypeOptions),
  severity: z.enum(severityOptions),
  priority: z.enum(['Normal', 'High', 'Urgent']),
  fault_description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000, 'Description must be 2000 characters or less'),
  customers_affected: optionalNumber('Customers affected', 0),
  area_affected: optionalText(500, 'Area affected'),
  repair_notes: optionalText(2000, 'Repair notes'),
  outage_duration: optionalNumber('Outage duration', 0)
});

type FaultFormValues = z.infer<typeof faultFormSchema>;

const today = () => new Date().toISOString().slice(0, 10);

const defaultValues: FaultFormValues = {
  transformer_id: '',
  inspection_id: '',
  fault_date: today(),
  fault_source: 'Field Observation',
  fault_type: 'Other',
  severity: 'Major',
  priority: 'Normal',
  fault_description: '',
  customers_affected: undefined,
  area_affected: '',
  repair_notes: '',
  outage_duration: undefined
};

function isoDate(value?: string) {
  if (!value) return today();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return today();
  return date.toISOString().slice(0, 10);
}

function valuesFromFault(item: Fault): FaultFormValues {
  return {
    transformer_id: refId(item.transformer_id),
    inspection_id: refId(item.inspection_id),
    fault_date: isoDate(item.fault_date),
    fault_source: (sourceOptions.includes(item.fault_source as never) ? item.fault_source : 'Field Observation') as FaultFormValues['fault_source'],
    fault_type: (faultTypeOptions.includes(item.fault_type as never) ? item.fault_type : 'Other') as FaultFormValues['fault_type'],
    severity: (severityOptions.includes(item.severity as never) ? item.severity : 'Major') as FaultFormValues['severity'],
    priority: item.severity === 'Complete Outage' || item.severity === 'Critical' ? 'Urgent' : item.severity === 'Major' ? 'High' : 'Normal',
    fault_description: item.fault_description ?? '',
    customers_affected: item.customers_affected,
    area_affected: item.area_affected ?? '',
    repair_notes: item.resolution_description ?? '',
    outage_duration: item.downtime_hours
  };
}

function stripEmpty<T>(value: T): T | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return (trimmed === '' ? undefined : trimmed) as T | undefined;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const next: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      const cleaned = stripEmpty(child);
      if (cleaned !== undefined) next[key] = cleaned;
    });
    return (Object.keys(next).length === 0 ? undefined : next) as T | undefined;
  }
  return value;
}

function toPayload(values: FaultFormValues, isEdit: boolean): FaultMutationPayload {
  return stripEmpty({
    transformer_id: isEdit ? undefined : values.transformer_id,
    inspection_id: isEdit ? undefined : values.inspection_id,
    fault_date: isEdit ? undefined : values.fault_date,
    fault_source: isEdit ? undefined : values.fault_source,
    fault_type: values.fault_type,
    severity: values.severity,
    fault_description: values.fault_description,
    customers_affected: values.customers_affected,
    area_affected: values.area_affected
  }) ?? {};
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="field-error">{message}</span>;
}

function invalidateFaultWork(queryClient: ReturnType<typeof useQueryClient>, transformerId?: string, faultId?: string, inspectionId?: string) {
  void queryClient.invalidateQueries({ queryKey: ['faults'] });
  void queryClient.invalidateQueries({ queryKey: ['faults', 'open'] });
  void queryClient.invalidateQueries({ queryKey: ['transformers'] });
  void queryClient.invalidateQueries({ queryKey: ['transformers', 'stats'] });
  void queryClient.invalidateQueries({ queryKey: ['inspections', 'overdue'] });
  void queryClient.invalidateQueries({ queryKey: ['maintenance', 'upcoming'] });
  if (faultId) void queryClient.invalidateQueries({ queryKey: ['faults', faultId] });
  if (transformerId) {
    void queryClient.invalidateQueries({ queryKey: ['transformers', transformerId] });
    void queryClient.invalidateQueries({ queryKey: ['faults', 'transformer', transformerId] });
  }
  if (inspectionId) void queryClient.invalidateQueries({ queryKey: ['inspections', inspectionId] });
}

function transformerOptionLabel(item: Transformer) {
  return [item.asset_id, getTransformerName(item), item.location_administrative?.site_name || item.site_name].filter(Boolean).join(' / ') || item._id;
}

export function FaultFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = mode === 'edit';

  const form = useForm<FaultFormValues>({
    resolver: zodResolver(faultFormSchema),
    defaultValues: {
      ...defaultValues,
      transformer_id: searchParams.get('transformerId') ?? '',
      inspection_id: searchParams.get('inspectionId') ?? ''
    }
  });
  const { register, handleSubmit, reset, watch, formState } = form;

  const faultQuery = useQuery({ queryKey: ['faults', id], queryFn: () => faultApi.getById(id ?? ''), enabled: isEdit && Boolean(id) });
  const transformersQuery = useQuery({ queryKey: ['transformers', 'list', 'fault-form'], queryFn: () => transformerApi.list({ limit: 500 }) });
  const inspectionId = searchParams.get('inspectionId') ?? '';
  const inspectionQuery = useQuery({ queryKey: ['inspections', inspectionId], queryFn: () => inspectionApi.getById(inspectionId), enabled: !isEdit && Boolean(inspectionId) });

  useEffect(() => {
    if (isEdit && faultQuery.data) reset(valuesFromFault(faultQuery.data));
  }, [faultQuery.data, isEdit, reset]);

  useEffect(() => {
    if (!isEdit && inspectionQuery.data) {
      reset({
        ...defaultValues,
        transformer_id: refId(inspectionQuery.data.transformer_id),
        inspection_id: inspectionQuery.data._id,
        fault_date: isoDate(inspectionQuery.data.inspection_date),
        fault_source: 'Field Observation',
        severity: inspectionQuery.data.physical?.overall_condition === 'Critical' ? 'Critical' : inspectionQuery.data.physical?.overall_condition === 'Poor' ? 'Major' : 'Minor',
        fault_type: inspectionQuery.data.electrical?.overload_flag ? 'Overload' : inspectionQuery.data.physical?.oil_leakage && inspectionQuery.data.physical.oil_leakage !== 'None' ? 'Oil Leak' : 'Other',
        fault_description: `Inspection follow-up: ${inspectionQuery.data.condition_narrative || inspectionQuery.data.recommended_action || 'Fault requires review'}`,
        area_affected: inspectionQuery.data.recommended_action_details ?? ''
      });
    }
  }, [inspectionQuery.data, isEdit, reset]);

  const createMutation = useMutation({
    mutationFn: (payload: FaultMutationPayload) => faultApi.create(payload),
    onSuccess: (fault) => {
      invalidateFaultWork(queryClient, refId(fault.transformer_id) || watch('transformer_id'), fault._id, watch('inspection_id'));
      toast.success('Fault reported');
      navigate(`/faults/${fault._id}`);
    },
    onError: notifyApiError
  });

  const updateMutation = useMutation({
    mutationFn: (payload: FaultMutationPayload) => faultApi.update(id ?? '', payload),
    onSuccess: (fault) => {
      invalidateFaultWork(queryClient, refId(fault.transformer_id) || watch('transformer_id'), fault._id || id, watch('inspection_id'));
      toast.success('Fault updated');
      navigate(`/faults/${fault._id || id}`);
    },
    onError: notifyApiError
  });

  const transformers = transformersQuery.data?.data ?? [];
  const selectedTransformer = transformers.find((item) => item._id === watch('transformer_id')) || (typeof faultQuery.data?.transformer_id === 'object' ? faultQuery.data.transformer_id : undefined);
  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

  const onSubmit = (values: FaultFormValues) => {
    const payload = toPayload(values, isEdit);
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  if (isEdit && !id) return <ErrorState error={new Error('Missing fault id')} title="Fault unavailable" />;
  if (isEdit && faultQuery.isLoading) return <Loading label="Loading fault for editing" />;
  if (isEdit && faultQuery.error) return <ErrorState error={faultQuery.error} title="Fault unavailable" />;

  return (
    <div className="page-stack form-page">
      <section className="detail-hero form-hero">
        <div>
          <Link className="back-link" to={isEdit && id ? `/faults/${id}` : '/faults'}><ArrowLeft size={16} /><span>{isEdit ? 'Back to Fault' : 'Back to Faults'}</span></Link>
          <div className="detail-title-row">
            <div>
              <h1>{isEdit ? `Edit ${faultLabel(faultQuery.data)}` : 'Report Fault'}</h1>
              <p>{isEdit ? 'Update editable incident details.' : 'Create a transformer fault report for operations follow-up.'}</p>
            </div>
            <span className="badge">{selectedTransformer ? transformerOptionLabel(selectedTransformer) : 'Transformer required'}</span>
          </div>
        </div>
      </section>

      <section className="status-strip">
        <div><ShieldAlert size={18} /><span>Incident context</span></div>
        <small>{inspectionQuery.data ? `From inspection on ${formatDate(inspectionQuery.data.inspection_date)}` : isEdit ? 'Immutable fields are locked' : 'Select the impacted transformer'}</small>
      </section>

      <form className="panel transformer-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="panel-heading">
          <h2>Fault details</h2>
          <button className="primary-button" type="submit" disabled={saving}><Save size={16} /><span>{saving ? 'Saving' : isEdit ? 'Save Changes' : 'Create Fault'}</span></button>
        </div>
        {mutationError ? <div className="form-error" role="alert">{getApiErrorMessage(mutationError)}</div> : null}

        <section className="form-section">
          <h3>Incident Information</h3>
          <div className="form-grid">
            <label><span>Transformer</span><select disabled={isEdit || transformersQuery.isLoading || transformers.length === 0} {...register('transformer_id')}><option value="">{transformersQuery.isLoading ? 'Loading transformers' : 'Select transformer'}</option>{transformers.map((item) => <option value={item._id} key={item._id}>{transformerOptionLabel(item)}</option>)}</select><FieldError message={formState.errors.transformer_id?.message} /></label>
            <label><span>Date Reported</span><input type="date" max={today()} disabled={isEdit} {...register('fault_date')} /><FieldError message={formState.errors.fault_date?.message} /></label>
            <label><span>Source</span><select disabled={isEdit} {...register('fault_source')}>{sourceOptions.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>
            <label><span>Fault Type</span><select {...register('fault_type')}>{faultTypeOptions.map((option) => <option value={option} key={option}>{option}</option>)}</select><FieldError message={formState.errors.fault_type?.message} /></label>
            <label><span>Severity</span><select {...register('severity')}>{severityOptions.map((option) => <option value={option} key={option}>{option}</option>)}</select><FieldError message={formState.errors.severity?.message} /></label>
            <label><span>Priority</span><select {...register('priority')}><option value="Normal">Normal</option><option value="High">High</option><option value="Urgent">Urgent</option></select><small>Priority is an operational cue; severity is saved to the backend.</small></label>
          </div>
        </section>

        <section className="form-section">
          <h3>Impact</h3>
          <div className="form-grid">
            <label><span>Description</span><textarea rows={5} {...register('fault_description')} /><FieldError message={formState.errors.fault_description?.message} /></label>
            <label><span>Customers Affected</span><input type="number" min={0} {...register('customers_affected')} /><FieldError message={formState.errors.customers_affected?.message} /></label>
            <label><span>Area Affected</span><textarea rows={3} {...register('area_affected')} /><FieldError message={formState.errors.area_affected?.message} /></label>
          </div>
        </section>

        <section className="form-section">
          <h3>Repair Notes</h3>
          <div className="form-grid">
            <label><span>Repair Notes</span><textarea rows={4} disabled {...register('repair_notes')} /><small>Use Resolve on the fault detail page to save repair notes.</small></label>
            <label><span>Outage Duration</span><input type="number" disabled {...register('outage_duration')} /><small>Downtime is calculated when resolving a fault.</small></label>
          </div>
        </section>
      </form>
    </div>
  );
}
