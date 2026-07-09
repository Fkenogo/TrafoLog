import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardCheck, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { getApiErrorMessage, notifyApiError } from '../../api/http';
import { inspectionApi, InspectionMutationPayload } from '../../api/inspectionApi';
import { transformerApi } from '../../api/transformerApi';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { Inspection, Transformer } from '../../types/api';
import { formatDate, getTransformerName } from '../../utils/format';

const visitTypeOptions = ['Routine Inspection', 'Follow-up', 'Audit'] as const;
const conditionOptions = ['Good', 'Fair', 'Poor', 'Critical'] as const;
const rustOptions = ['None', 'Minor', 'Severe'] as const;
const oilLeakageOptions = ['None', 'Slow Drip', 'Active Leak'] as const;
const bushingOptions = ['Good', 'Cracked', 'Broken'] as const;
const tankDamageOptions = ['None', 'Dents', 'Puncture'] as const;
const coolingOptions = ['Good', 'Damaged', 'Blocked'] as const;
const soundOptions = ['Normal', 'Unusual', 'Loud'] as const;
const oilLevelOptions = ['Full', 'Adequate', 'Low', 'Very Low'] as const;
const silicaOptions = ['Blue', 'Pink', 'White'] as const;
const presentOptions = ['Present', 'Damaged', 'Absent'] as const;
const binaryPresentOptions = ['Present', 'Absent'] as const;
const vegetationOptions = ['None', 'Moderate', 'Severe'] as const;
const actionOptions = ['No Action', 'Monitor', 'Schedule Maintenance', 'Urgent Repair', 'Replace'] as const;
const wizardSteps = [
  'Inspection Information',
  'Transformer Verification',
  'Physical Inspection',
  'Electrical Inspection',
  'Safety & Environment',
  'Assessment & Review'
];

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

const requiredPastDate = z
  .string()
  .min(1, 'Inspection date is required')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Inspection date must be valid')
  .refine((value) => new Date(value).getTime() <= Date.now(), 'Inspection date cannot be in the future');

const inspectionFormSchema = z.object({
  transformer_id: z.string().trim().min(1, 'Transformer is required'),
  inspection_date: requiredPastDate,
  visit_type: z.enum(visitTypeOptions),
  gps_lat: optionalNumber('Latitude', -90, 90),
  gps_lng: optionalNumber('Longitude', -180, 180),
  gps_accuracy: optionalNumber('GPS accuracy', 0),
  network_voltage_confirmed: z.boolean(),
  kva_rating_confirmed: z.boolean(),
  rating_discrepancy_details: optionalText(500, 'Rating discrepancy details'),
  physical_overall_condition: z.enum(conditionOptions),
  rust_corrosion: z.enum(rustOptions),
  oil_leakage: z.enum(oilLeakageOptions),
  bushing_condition: z.enum(bushingOptions),
  tank_body_damage: z.enum(tankDamageOptions),
  cooling_fins_condition: z.enum(coolingOptions),
  sound_level: z.enum(soundOptions),
  temperature: optionalNumber('Temperature', -20, 150),
  oil_level: z.enum(oilLevelOptions),
  silica_gel_color: z.enum(silicaOptions),
  oil_test_required: z.boolean(),
  oil_test_notes: optionalText(500, 'Oil test notes'),
  oil_temperature: optionalNumber('Oil temperature', -20, 150),
  load_current_a: optionalNumber('Phase A current', 0),
  load_current_b: optionalNumber('Phase B current', 0),
  load_current_c: optionalNumber('Phase C current', 0),
  voltage_hv_side: optionalNumber('HV side voltage', 0),
  voltage_lv_side: optionalNumber('LV side voltage', 0),
  load_percentage: optionalNumber('Load percentage', 0, 100),
  power_factor: optionalNumber('Power factor', 0, 1),
  frequency: optionalNumber('Frequency', 49, 51),
  security_fencing: z.enum(presentOptions),
  earthing: z.enum(binaryPresentOptions),
  warning_signs: z.enum(binaryPresentOptions),
  vegetation_encroachment: z.enum(vegetationOptions),
  unauthorised_connections: z.boolean(),
  safety_notes: optionalText(500, 'Safety notes'),
  condition_narrative: optionalText(2000, 'Narrative'),
  recommended_action: z.enum(actionOptions),
  recommended_action_details: optionalText(500, 'Recommended action details')
});

type InspectionFormValues = z.infer<typeof inspectionFormSchema>;

const today = () => new Date().toISOString().slice(0, 10);

const defaultValues: InspectionFormValues = {
  transformer_id: '',
  inspection_date: today(),
  visit_type: 'Routine Inspection',
  gps_lat: undefined,
  gps_lng: undefined,
  gps_accuracy: undefined,
  network_voltage_confirmed: true,
  kva_rating_confirmed: true,
  rating_discrepancy_details: '',
  physical_overall_condition: 'Good',
  rust_corrosion: 'None',
  oil_leakage: 'None',
  bushing_condition: 'Good',
  tank_body_damage: 'None',
  cooling_fins_condition: 'Good',
  sound_level: 'Normal',
  temperature: undefined,
  oil_level: 'Adequate',
  silica_gel_color: 'Blue',
  oil_test_required: false,
  oil_test_notes: '',
  oil_temperature: undefined,
  load_current_a: undefined,
  load_current_b: undefined,
  load_current_c: undefined,
  voltage_hv_side: undefined,
  voltage_lv_side: undefined,
  load_percentage: undefined,
  power_factor: undefined,
  frequency: 50,
  security_fencing: 'Present',
  earthing: 'Present',
  warning_signs: 'Present',
  vegetation_encroachment: 'None',
  unauthorised_connections: false,
  safety_notes: '',
  condition_narrative: '',
  recommended_action: 'No Action',
  recommended_action_details: ''
};

function isoDate(value?: string) {
  if (!value) return today();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return today();
  return date.toISOString().slice(0, 10);
}

function refId(value?: string | Transformer) {
  if (!value) return '';
  return typeof value === 'string' ? value : value._id;
}

function coerceOption<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]) {
  return options.includes(value as T[number]) ? (value as T[number]) : fallback;
}

function valuesFromInspection(item: Inspection): InspectionFormValues {
  const coordinates = item.gps_at_inspection?.coordinates ?? [];
  return {
    transformer_id: refId(item.transformer_id),
    inspection_date: isoDate(item.inspection_date),
    visit_type: coerceOption(item.visit_type, visitTypeOptions, 'Routine Inspection'),
    gps_lat: coordinates[1],
    gps_lng: coordinates[0],
    gps_accuracy: item.gps_accuracy,
    network_voltage_confirmed: item.network_voltage_confirmed ?? true,
    kva_rating_confirmed: item.kva_rating_confirmed ?? true,
    rating_discrepancy_details: item.rating_discrepancy_details ?? '',
    physical_overall_condition: coerceOption(item.physical?.overall_condition || item.overall_condition, conditionOptions, 'Good'),
    rust_corrosion: coerceOption(item.physical?.rust_corrosion, rustOptions, 'None'),
    oil_leakage: coerceOption(item.physical?.oil_leakage, oilLeakageOptions, 'None'),
    bushing_condition: coerceOption(item.physical?.bushing_condition, bushingOptions, 'Good'),
    tank_body_damage: coerceOption(item.physical?.tank_body_damage, tankDamageOptions, 'None'),
    cooling_fins_condition: coerceOption(item.physical?.cooling_fins_condition, coolingOptions, 'Good'),
    sound_level: coerceOption(item.physical?.sound_level, soundOptions, 'Normal'),
    temperature: item.physical?.temperature,
    oil_level: coerceOption(item.oil_breather?.oil_level, oilLevelOptions, 'Adequate'),
    silica_gel_color: coerceOption(item.oil_breather?.silica_gel_color, silicaOptions, 'Blue'),
    oil_test_required: item.oil_breather?.oil_test_required ?? false,
    oil_test_notes: item.oil_breather?.oil_test_notes ?? '',
    oil_temperature: item.oil_breather?.oil_temperature,
    load_current_a: item.electrical?.load_current_a,
    load_current_b: item.electrical?.load_current_b,
    load_current_c: item.electrical?.load_current_c,
    voltage_hv_side: item.electrical?.voltage_hv_side,
    voltage_lv_side: item.electrical?.voltage_lv_side,
    load_percentage: item.electrical?.load_percentage,
    power_factor: item.electrical?.power_factor,
    frequency: item.electrical?.frequency,
    security_fencing: coerceOption(item.site_safety?.security_fencing, presentOptions, 'Present'),
    earthing: coerceOption(item.site_safety?.earthing, binaryPresentOptions, 'Present'),
    warning_signs: coerceOption(item.site_safety?.warning_signs, binaryPresentOptions, 'Present'),
    vegetation_encroachment: coerceOption(item.site_safety?.vegetation_encroachment, vegetationOptions, 'None'),
    unauthorised_connections: item.site_safety?.unauthorised_connections ?? false,
    safety_notes: item.site_safety?.safety_notes ?? '',
    condition_narrative: item.condition_narrative ?? '',
    recommended_action: coerceOption(item.recommended_action, actionOptions, 'No Action'),
    recommended_action_details: item.recommended_action_details ?? ''
  };
}

function stripEmpty<T>(value: T): T | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return (trimmed === '' ? undefined : trimmed) as T | undefined;
  }
  if (typeof value === 'number' && Number.isNaN(value)) return undefined;
  if (Array.isArray(value)) return value as T;
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      const cleaned = stripEmpty(child);
      if (cleaned !== undefined) next[key] = cleaned;
    });
    return (Object.keys(next).length === 0 ? undefined : next) as T | undefined;
  }
  return value;
}

function createPayload(values: InspectionFormValues): InspectionMutationPayload {
  return stripEmpty({
    transformer_id: values.transformer_id,
    inspection_date: values.inspection_date,
    visit_type: values.visit_type,
    gps_lat: values.gps_lat,
    gps_lng: values.gps_lng,
    gps_accuracy: values.gps_accuracy,
    network_voltage_confirmed: values.network_voltage_confirmed,
    kva_rating_confirmed: values.kva_rating_confirmed,
    rating_discrepancy_details: values.rating_discrepancy_details,
    physical: {
      overall_condition: values.physical_overall_condition,
      rust_corrosion: values.rust_corrosion,
      oil_leakage: values.oil_leakage,
      bushing_condition: values.bushing_condition,
      tank_body_damage: values.tank_body_damage,
      cooling_fins_condition: values.cooling_fins_condition,
      sound_level: values.sound_level,
      temperature: values.temperature
    },
    oil_breather: {
      oil_level: values.oil_level,
      silica_gel_color: values.silica_gel_color,
      oil_test_required: values.oil_test_required,
      oil_test_notes: values.oil_test_notes,
      oil_temperature: values.oil_temperature
    },
    electrical: {
      load_current_a: values.load_current_a,
      load_current_b: values.load_current_b,
      load_current_c: values.load_current_c,
      voltage_hv_side: values.voltage_hv_side,
      voltage_lv_side: values.voltage_lv_side,
      load_percentage: values.load_percentage,
      power_factor: values.power_factor,
      frequency: values.frequency
    },
    site_safety: {
      security_fencing: values.security_fencing,
      earthing: values.earthing,
      warning_signs: values.warning_signs,
      vegetation_encroachment: values.vegetation_encroachment,
      unauthorised_connections: values.unauthorised_connections,
      safety_notes: values.safety_notes
    },
    condition_narrative: values.condition_narrative,
    recommended_action: values.recommended_action,
    recommended_action_details: values.recommended_action_details
  }) ?? {};
}

function updatePayload(values: InspectionFormValues): InspectionMutationPayload {
  return stripEmpty({
    transformer_id: values.transformer_id,
    inspection_date: values.inspection_date,
    visit_type: values.visit_type,
    network_voltage_confirmed: values.network_voltage_confirmed,
    kva_rating_confirmed: values.kva_rating_confirmed,
    physical: {
      overall_condition: values.physical_overall_condition,
      rust_corrosion: values.rust_corrosion,
      oil_leakage: values.oil_leakage,
      bushing_condition: values.bushing_condition,
      tank_body_damage: values.tank_body_damage,
      cooling_fins_condition: values.cooling_fins_condition
    },
    oil_breather: {
      oil_level: values.oil_level,
      silica_gel_color: values.silica_gel_color,
      oil_test_required: values.oil_test_required
    },
    electrical: {
      load_current_a: values.load_current_a,
      load_current_b: values.load_current_b,
      load_current_c: values.load_current_c,
      voltage_hv_side: values.voltage_hv_side,
      voltage_lv_side: values.voltage_lv_side
    },
    site_safety: {
      security_fencing: values.security_fencing,
      earthing: values.earthing,
      warning_signs: values.warning_signs,
      vegetation_encroachment: values.vegetation_encroachment,
      unauthorised_connections: values.unauthorised_connections
    },
    condition_narrative: values.condition_narrative,
    recommended_action: values.recommended_action,
    recommended_action_details: values.recommended_action_details
  }) ?? {};
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="field-error">{message}</span>;
}

function SelectField({
  label,
  value,
  options,
  disabled,
  error,
  registration
}: {
  label: string;
  value?: string;
  options: readonly string[];
  disabled?: boolean;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  return (
    <label>
      <span>{label}</span>
      <select disabled={disabled} {...registration} defaultValue={value}>
        {options.map((option) => <option value={option} key={option}>{option}</option>)}
      </select>
      <FieldError message={error} />
    </label>
  );
}

function invalidateInspectionWork(queryClient: ReturnType<typeof useQueryClient>, transformerId?: string, inspectionId?: string) {
  void queryClient.invalidateQueries({ queryKey: ['inspections'] });
  void queryClient.invalidateQueries({ queryKey: ['inspections', 'list'] });
  void queryClient.invalidateQueries({ queryKey: ['inspections', 'overdue'] });
  void queryClient.invalidateQueries({ queryKey: ['transformers'] });
  void queryClient.invalidateQueries({ queryKey: ['transformers', 'stats'] });
  void queryClient.invalidateQueries({ queryKey: ['faults', 'open'] });
  void queryClient.invalidateQueries({ queryKey: ['maintenance', 'upcoming'] });
  if (inspectionId) void queryClient.invalidateQueries({ queryKey: ['inspections', inspectionId] });
  if (transformerId) {
    void queryClient.invalidateQueries({ queryKey: ['transformers', transformerId] });
    void queryClient.invalidateQueries({ queryKey: ['inspections', 'transformer', transformerId] });
    void queryClient.invalidateQueries({ queryKey: ['inspections', 'transformer', transformerId, 'latest'] });
  }
}

function transformerOptionLabel(item: Transformer) {
  const parts = [item.asset_id, getTransformerName(item), item.location_administrative?.site_name || item.site_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : item._id;
}

export function InspectionFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = mode === 'edit';
  const [currentStep, setCurrentStep] = useState(0);
  const preselectedTransformerId = searchParams.get('transformerId') ?? '';

  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionFormSchema),
    defaultValues: { ...defaultValues, transformer_id: preselectedTransformerId }
  });
  const { register, handleSubmit, reset, watch, formState } = form;
  const selectedTransformerId = watch('transformer_id');
  const watchedLoad = watch('load_percentage');

  const inspectionQuery = useQuery({
    queryKey: ['inspections', id],
    queryFn: () => inspectionApi.getById(id ?? ''),
    enabled: isEdit && Boolean(id)
  });

  const transformersQuery = useQuery({
    queryKey: ['transformers', 'list', 'inspection-form'],
    queryFn: () => transformerApi.list({ limit: 500 })
  });

  useEffect(() => {
    if (isEdit && inspectionQuery.data) reset(valuesFromInspection(inspectionQuery.data));
    if (!isEdit) reset({ ...defaultValues, inspection_date: today(), transformer_id: preselectedTransformerId });
  }, [inspectionQuery.data, isEdit, preselectedTransformerId, reset]);

  const createMutation = useMutation({
    mutationFn: (payload: InspectionMutationPayload) => inspectionApi.create(payload),
    onSuccess: (inspection) => {
      const transformerId = refId(inspection.transformer_id) || watch('transformer_id');
      invalidateInspectionWork(queryClient, transformerId, inspection._id);
      toast.success('Inspection created');
      navigate(`/inspections/${inspection._id}`);
    },
    onError: notifyApiError
  });

  const updateMutation = useMutation({
    mutationFn: (payload: InspectionMutationPayload) => inspectionApi.update(id ?? '', payload),
    onSuccess: (inspection) => {
      const transformerId = refId(inspection.transformer_id) || watch('transformer_id');
      invalidateInspectionWork(queryClient, transformerId, inspection._id || id);
      toast.success('Inspection updated');
      navigate(`/inspections/${inspection._id || id}`);
    },
    onError: notifyApiError
  });

  const transformers = transformersQuery.data?.data ?? [];
  const selectedTransformer = useMemo(() => {
    return transformers.find((item) => item._id === selectedTransformerId) || (typeof inspectionQuery.data?.transformer_id === 'object' ? inspectionQuery.data.transformer_id : undefined);
  }, [inspectionQuery.data?.transformer_id, selectedTransformerId, transformers]);

  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;
  const overloadPreview = Number(watchedLoad) > 90;

  const onSubmit = (values: InspectionFormValues) => {
    if (isEdit) updateMutation.mutate(updatePayload(values));
    else createMutation.mutate(createPayload(values));
  };
  const isFinalStep = currentStep === wizardSteps.length - 1;

  if (isEdit && !id) return <ErrorState error={new Error('Missing inspection id')} title="Inspection unavailable" />;
  if (isEdit && inspectionQuery.isLoading) return <Loading label="Loading inspection for editing" />;
  if (isEdit && inspectionQuery.error) return <ErrorState error={inspectionQuery.error} title="Inspection unavailable" />;

  return (
    <div className="page-stack form-page">
      <section className="detail-hero form-hero">
        <div>
          <Link className="back-link" to={isEdit && id ? `/inspections/${id}` : '/inspections'}>
            <ArrowLeft size={16} />
            <span>{isEdit ? 'Back to Inspection' : 'Back to Inspections'}</span>
          </Link>
          <div className="detail-title-row">
            <div>
              <h1>{isEdit ? 'Edit Inspection' : 'New Inspection'}</h1>
              <p>{isEdit ? `Update the inspection from ${formatDate(inspectionQuery.data?.inspection_date)}.` : 'Capture a field inspection for a transformer.'}</p>
            </div>
            <div className="detail-badge-row">
              <span className="badge">{isEdit ? inspectionQuery.data?.recommended_action || 'Saved inspection' : 'Draft inspection'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="status-strip">
        <div>
          <ClipboardCheck size={18} />
          <span>Transformer</span>
        </div>
        <small>{selectedTransformer ? transformerOptionLabel(selectedTransformer) : 'Select a transformer before saving'}</small>
      </section>

      <form className="panel transformer-form inspection-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="panel-heading">
          <h2>Inspection record</h2>
          <button className="primary-button" type={isFinalStep ? 'submit' : 'button'} disabled={saving} onClick={isFinalStep ? undefined : () => setCurrentStep((step) => Math.min(wizardSteps.length - 1, step + 1))}>
            <Save size={16} />
            <span>{saving ? 'Saving' : isFinalStep ? isEdit ? 'Save Changes' : 'Create Inspection' : 'Next Step'}</span>
          </button>
        </div>

        {mutationError ? <div className="form-error" role="alert">{getApiErrorMessage(mutationError)}</div> : null}
        {transformersQuery.error ? <ErrorState error={transformersQuery.error} title="Transformer list unavailable" /> : null}

        <div className="wizard-steps" aria-label="Inspection steps">
          {wizardSteps.map((step, index) => (
            <button className={index === currentStep ? 'active' : index < currentStep ? 'complete' : undefined} type="button" onClick={() => setCurrentStep(index)} key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </button>
          ))}
        </div>

        {currentStep === 0 && <section className="form-section">
          <h3>Summary</h3>
          <div className="form-grid">
            <label>
              <span>Transformer</span>
              <select disabled={isEdit || transformersQuery.isLoading || transformers.length === 0} {...register('transformer_id')}>
                <option value="">{transformersQuery.isLoading ? 'Loading transformers' : transformers.length === 0 ? 'No transformers available' : 'Select transformer'}</option>
                {transformers.map((item) => <option value={item._id} key={item._id}>{transformerOptionLabel(item)}</option>)}
              </select>
              <FieldError message={formState.errors.transformer_id?.message} />
            </label>
            <label>
              <span>Inspection Date</span>
              <input type="date" max={today()} {...register('inspection_date')} />
              <FieldError message={formState.errors.inspection_date?.message} />
            </label>
            <SelectField label="Visit Type" options={visitTypeOptions} registration={register('visit_type')} error={formState.errors.visit_type?.message} />
            <label>
              <span>Inspector</span>
              <input value="Current signed-in user" disabled readOnly />
            </label>
          </div>
        </section>}

        {currentStep === 1 && <section className="form-section">
          <h3>Transformer Checks</h3>
          <div className="form-grid">
            <label className="checkbox-field">
              <input type="checkbox" {...register('network_voltage_confirmed')} />
              <span>Network voltage confirmed</span>
            </label>
            <label className="checkbox-field">
              <input type="checkbox" {...register('kva_rating_confirmed')} />
              <span>kVA rating confirmed</span>
            </label>
            <label>
              <span>Rating Discrepancy Details</span>
              <textarea rows={3} disabled={isEdit} {...register('rating_discrepancy_details')} />
              <FieldError message={formState.errors.rating_discrepancy_details?.message} />
            </label>
          </div>
        </section>}

        {currentStep === 2 && <section className="form-section">
          <h3>Physical Inspection</h3>
          <div className="form-grid">
            <SelectField label="Physical Condition" options={conditionOptions} registration={register('physical_overall_condition')} error={formState.errors.physical_overall_condition?.message} />
            <SelectField label="Rust" options={rustOptions} registration={register('rust_corrosion')} error={formState.errors.rust_corrosion?.message} />
            <SelectField label="Oil Leakage" options={oilLeakageOptions} registration={register('oil_leakage')} error={formState.errors.oil_leakage?.message} />
            <SelectField label="Bushings" options={bushingOptions} registration={register('bushing_condition')} error={formState.errors.bushing_condition?.message} />
            <SelectField label="Tank Body" options={tankDamageOptions} registration={register('tank_body_damage')} error={formState.errors.tank_body_damage?.message} />
            <SelectField label="Cooling" options={coolingOptions} registration={register('cooling_fins_condition')} error={formState.errors.cooling_fins_condition?.message} />
            <SelectField label="Sound Level" options={soundOptions} disabled={isEdit} registration={register('sound_level')} error={formState.errors.sound_level?.message} />
            <label>
              <span>Temperature</span>
              <input type="number" step="0.1" disabled={isEdit} {...register('temperature')} />
              <FieldError message={formState.errors.temperature?.message} />
            </label>
          </div>
        </section>}

        {currentStep === 2 && <section className="form-section">
          <h3>Oil</h3>
          <div className="form-grid">
            <SelectField label="Oil Level" options={oilLevelOptions} registration={register('oil_level')} error={formState.errors.oil_level?.message} />
            <SelectField label="Silica Gel Color" options={silicaOptions} registration={register('silica_gel_color')} error={formState.errors.silica_gel_color?.message} />
            <label className="checkbox-field">
              <input type="checkbox" {...register('oil_test_required')} />
              <span>Oil test required</span>
            </label>
            <label>
              <span>Oil Temperature</span>
              <input type="number" step="0.1" disabled={isEdit} {...register('oil_temperature')} />
              <FieldError message={formState.errors.oil_temperature?.message} />
            </label>
            <label>
              <span>Oil Test Notes</span>
              <textarea rows={3} disabled={isEdit} {...register('oil_test_notes')} />
              <FieldError message={formState.errors.oil_test_notes?.message} />
            </label>
          </div>
        </section>}

        {currentStep === 3 && <section className="form-section">
          <h3>Electrical Inspection</h3>
          <div className="form-grid">
            <label>
              <span>Phase A Current</span>
              <input type="number" step="0.01" {...register('load_current_a')} />
              <FieldError message={formState.errors.load_current_a?.message} />
            </label>
            <label>
              <span>Phase B Current</span>
              <input type="number" step="0.01" {...register('load_current_b')} />
              <FieldError message={formState.errors.load_current_b?.message} />
            </label>
            <label>
              <span>Phase C Current</span>
              <input type="number" step="0.01" {...register('load_current_c')} />
              <FieldError message={formState.errors.load_current_c?.message} />
            </label>
            <label>
              <span>HV Side Voltage</span>
              <input type="number" step="0.01" {...register('voltage_hv_side')} />
              <FieldError message={formState.errors.voltage_hv_side?.message} />
            </label>
            <label>
              <span>LV Side Voltage</span>
              <input type="number" step="0.01" {...register('voltage_lv_side')} />
              <FieldError message={formState.errors.voltage_lv_side?.message} />
            </label>
            <label>
              <span>Load %</span>
              <input type="number" step="0.01" disabled={isEdit} {...register('load_percentage')} />
              <FieldError message={formState.errors.load_percentage?.message} />
            </label>
            <label>
              <span>Voltage Frequency</span>
              <input type="number" step="0.01" disabled={isEdit} {...register('frequency')} />
              <FieldError message={formState.errors.frequency?.message} />
            </label>
            <label>
              <span>Power Factor</span>
              <input type="number" step="0.01" disabled={isEdit} {...register('power_factor')} />
              <FieldError message={formState.errors.power_factor?.message} />
            </label>
            <label className="checkbox-field">
              <input type="checkbox" checked={overloadPreview} readOnly disabled />
              <span>Overload flag</span>
            </label>
          </div>
        </section>}

        {currentStep === 4 && <section className="form-section">
          <h3>Environmental</h3>
          <div className="form-grid">
            <SelectField label="Security Fencing" options={presentOptions} registration={register('security_fencing')} error={formState.errors.security_fencing?.message} />
            <SelectField label="Earthing" options={binaryPresentOptions} registration={register('earthing')} error={formState.errors.earthing?.message} />
            <SelectField label="Warning Signs" options={binaryPresentOptions} registration={register('warning_signs')} error={formState.errors.warning_signs?.message} />
            <SelectField label="Vegetation Encroachment" options={vegetationOptions} registration={register('vegetation_encroachment')} error={formState.errors.vegetation_encroachment?.message} />
            <label className="checkbox-field">
              <input type="checkbox" {...register('unauthorised_connections')} />
              <span>Unauthorised connections</span>
            </label>
            <label>
              <span>Safety Notes</span>
              <textarea rows={3} disabled={isEdit} {...register('safety_notes')} />
              <FieldError message={formState.errors.safety_notes?.message} />
            </label>
          </div>
        </section>}

        {currentStep === 4 && <section className="form-section">
          <h3>GPS</h3>
          <div className="form-grid">
            <label>
              <span>Latitude</span>
              <input type="number" step="0.000001" disabled={isEdit} {...register('gps_lat')} />
              <FieldError message={formState.errors.gps_lat?.message} />
            </label>
            <label>
              <span>Longitude</span>
              <input type="number" step="0.000001" disabled={isEdit} {...register('gps_lng')} />
              <FieldError message={formState.errors.gps_lng?.message} />
            </label>
            <label>
              <span>GPS Accuracy</span>
              <input type="number" step="0.1" disabled={isEdit} {...register('gps_accuracy')} />
              <FieldError message={formState.errors.gps_accuracy?.message} />
            </label>
          </div>
        </section>}

        {currentStep === 5 && <section className="form-section">
          <h3>Inspector Notes</h3>
          <div className="form-grid">
            <label>
              <span>Narrative</span>
              <textarea rows={5} {...register('condition_narrative')} />
              <FieldError message={formState.errors.condition_narrative?.message} />
            </label>
            <SelectField label="Recommended Action" options={actionOptions} registration={register('recommended_action')} error={formState.errors.recommended_action?.message} />
            <label>
              <span>Recommended Action Details</span>
              <textarea rows={4} {...register('recommended_action_details')} />
              <FieldError message={formState.errors.recommended_action_details?.message} />
            </label>
          </div>
        </section>}

        {currentStep === 5 && <section className="form-section">
          <h3>Attachments</h3>
          <div className="placeholder-panel">Photographs can be reviewed when inspection records include them. Upload support is not enabled in this workflow.</div>
        </section>}

        <div className="form-footer">
          <button className="secondary-button" type="button" disabled={currentStep === 0 || saving} onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}>Previous</button>
          <span>Step {currentStep + 1} of {wizardSteps.length}</span>
          {isFinalStep ? (
            <button className="primary-button" type="submit" disabled={saving}><Save size={16} /><span>{saving ? 'Saving' : isEdit ? 'Save Changes' : 'Create Inspection'}</span></button>
          ) : (
            <button className="primary-button" type="button" disabled={saving} onClick={() => setCurrentStep((step) => Math.min(wizardSteps.length - 1, step + 1))}>Next Step</button>
          )}
        </div>
      </form>
    </div>
  );
}
