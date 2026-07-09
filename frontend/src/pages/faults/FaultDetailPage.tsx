import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ClipboardCheck, Pencil, Play, UserCheck, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { faultApi, FaultResolvePayload } from '../../api/faultApi';
import { getApiErrorMessage, notifyApiError } from '../../api/http';
import { inspectionApi } from '../../api/inspectionApi';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { useAuth } from '../../hooks/useAuth';
import { Fault, Inspection, Transformer } from '../../types/api';
import { formatDate, getTransformerName } from '../../utils/format';
import {
  asTransformer,
  displayFaultStatus,
  faultLabel,
  faultStatusBadgeClass,
  faultTransformerName,
  nextLifecycleAction,
  readable,
  refId,
  severityBadgeClass,
  transformerSite,
  userName
} from './faultHelpers';

type Tab = 'overview' | 'transformer' | 'timeline' | 'resolution' | 'inspection';

function DetailField({ label, value }: { label: string; value?: ReactNode }) {
  return <div className="detail-field"><span>{label}</span><strong>{value || 'Not recorded'}</strong></div>;
}

function invalidateFaultWork(queryClient: ReturnType<typeof useQueryClient>, fault?: Fault) {
  const transformerId = refId(fault?.transformer_id);
  const inspectionId = refId(fault?.inspection_id);
  void queryClient.invalidateQueries({ queryKey: ['faults'] });
  void queryClient.invalidateQueries({ queryKey: ['faults', 'open'] });
  void queryClient.invalidateQueries({ queryKey: ['faults', fault?._id] });
  void queryClient.invalidateQueries({ queryKey: ['transformers'] });
  void queryClient.invalidateQueries({ queryKey: ['transformers', 'stats'] });
  void queryClient.invalidateQueries({ queryKey: ['inspections', 'overdue'] });
  void queryClient.invalidateQueries({ queryKey: ['maintenance', 'upcoming'] });
  if (transformerId) {
    void queryClient.invalidateQueries({ queryKey: ['transformers', transformerId] });
    void queryClient.invalidateQueries({ queryKey: ['faults', 'transformer', transformerId] });
  }
  if (inspectionId) void queryClient.invalidateQueries({ queryKey: ['inspections', inspectionId] });
}

function timelineRows(fault?: Fault) {
  return [
    { label: 'Reported', date: fault?.fault_date || fault?.created_at, complete: true },
    { label: 'Assigned', date: fault?.date_assigned, complete: Boolean(fault?.date_assigned || ['Assigned', 'In Progress', 'Resolved', 'Closed'].includes(fault?.fault_status ?? '')) },
    { label: 'Engineer Accepted', date: fault?.date_assigned, complete: ['In Progress', 'Resolved', 'Closed'].includes(fault?.fault_status ?? '') },
    { label: 'Repair Started', date: fault?.updated_at, complete: ['In Progress', 'Resolved', 'Closed'].includes(fault?.fault_status ?? '') },
    { label: 'Resolved', date: fault?.resolved_date, complete: ['Resolved', 'Closed'].includes(fault?.fault_status ?? '') },
    { label: 'Closed', date: fault?.updated_at, complete: fault?.fault_status === 'Closed' }
  ];
}

export function FaultDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showAssign, setShowAssign] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [resolveDescription, setResolveDescription] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [partsReplaced, setPartsReplaced] = useState('');

  const faultQuery = useQuery({ queryKey: ['faults', id], queryFn: () => faultApi.getById(id ?? ''), enabled: Boolean(id) });
  const fault = faultQuery.data;
  const transformer = asTransformer(fault?.transformer_id);
  const inspectionId = refId(fault?.inspection_id);
  const inspectionQuery = useQuery({ queryKey: ['inspections', inspectionId], queryFn: () => inspectionApi.getById(inspectionId), enabled: Boolean(inspectionId) && typeof fault?.inspection_id !== 'object' });
  const inspection = (typeof fault?.inspection_id === 'object' ? fault.inspection_id : inspectionQuery.data) as Inspection | undefined;

  const assignMutation = useMutation({
    mutationFn: () => faultApi.assign(id ?? '', { assigned_to: user?._id ?? '' }),
    onSuccess: (updated) => {
      invalidateFaultWork(queryClient, updated);
      setShowAssign(false);
      toast.success('Fault assigned');
    },
    onError: notifyApiError
  });

  const startMutation = useMutation({
    mutationFn: () => faultApi.escalate(id ?? '', 'Engineer accepted the assignment and repair work has started'),
    onSuccess: (updated) => {
      invalidateFaultWork(queryClient, updated);
      toast.success('Fault moved to in progress');
    },
    onError: notifyApiError
  });

  const resolveMutation = useMutation({
    mutationFn: (payload: FaultResolvePayload) => faultApi.resolve(id ?? '', payload),
    onSuccess: (updated) => {
      invalidateFaultWork(queryClient, updated);
      setShowResolve(false);
      toast.success('Fault resolved');
    },
    onError: notifyApiError
  });

  const closeMutation = useMutation({
    mutationFn: () => faultApi.close(id ?? ''),
    onSuccess: (updated) => {
      invalidateFaultWork(queryClient, updated);
      toast.success('Fault closed');
    },
    onError: notifyApiError
  });

  const action = nextLifecycleAction(fault?.fault_status);
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'transformer', label: 'Transformer' },
    { id: 'timeline', label: 'Incident Timeline' },
    { id: 'resolution', label: 'Resolution' },
    { id: 'inspection', label: 'Related Inspection' }
  ];
  const rows = useMemo(() => timelineRows(fault), [fault]);

  if (!id) return <ErrorState error={new Error('Missing fault id')} title="Fault unavailable" />;
  if (faultQuery.isLoading) return <Loading label="Loading fault" />;
  if (faultQuery.error) return <ErrorState error={faultQuery.error} title="Fault unavailable" />;
  if (!fault) return <EmptyState title="Fault not found" message="The selected incident could not be loaded." />;

  return (
    <div className="page-stack detail-page">
      <section className="detail-hero">
        <div>
          <Link className="back-link" to="/faults"><ArrowLeft size={16} /><span>Back to Faults</span></Link>
          <div className="detail-title-row">
            <div>
              <span className="eyebrow">Incident management</span>
              <h1>{faultLabel(fault)}</h1>
              <p>{faultTransformerName(fault)} / {transformerSite(fault.transformer_id)} / reported {formatDate(fault.fault_date || fault.created_at)}</p>
            </div>
            <div className="detail-badge-row">
              <span className={severityBadgeClass(fault.severity)}>{fault.severity || 'Unrated'}</span>
              <span className={faultStatusBadgeClass(fault.fault_status)}>{displayFaultStatus(fault.fault_status)}</span>
            </div>
          </div>
        </div>
        <div className="detail-action-row">
          <Link className="secondary-button" to={`/faults/${fault._id}/edit`}><Pencil size={16} /><span>Edit</span></Link>
          <button className="secondary-button" type="button" disabled={action !== 'assign'} onClick={() => setShowAssign(true)}><UserCheck size={16} /><span>Assign</span></button>
          <button className="secondary-button" type="button" disabled={action !== 'start' || startMutation.isPending} onClick={() => startMutation.mutate()}><Play size={16} /><span>Start Work</span></button>
          <button className="secondary-button" type="button" disabled={action !== 'resolve'} onClick={() => setShowResolve(true)}><CheckCircle2 size={16} /><span>Resolve</span></button>
          <button className="secondary-button" type="button" disabled={action !== 'close' || closeMutation.isPending} onClick={() => closeMutation.mutate()}><XCircle size={16} /><span>Close</span></button>
        </div>
      </section>

      {showAssign && (
        <section className="panel confirmation-panel">
          <div><h2>Assign fault</h2><p>Assign this incident to your user account for follow-up.</p></div>
          <div className="confirmation-actions">
            <button className="secondary-button" type="button" onClick={() => setShowAssign(false)}>Cancel</button>
            <button className="primary-button" type="button" disabled={!user?._id || assignMutation.isPending} onClick={() => assignMutation.mutate()}><UserCheck size={16} /><span>{assignMutation.isPending ? 'Assigning' : 'Confirm Assignment'}</span></button>
          </div>
          {assignMutation.error ? <div className="form-error">{getApiErrorMessage(assignMutation.error)}</div> : null}
        </section>
      )}

      {showResolve && (
        <section className="panel confirmation-panel">
          <div><h2>Resolve fault</h2><p>Resolution notes are required before this incident can move to verification and closure.</p></div>
          <label><span>Repair Notes</span><textarea value={resolveDescription} onChange={(event) => setResolveDescription(event.target.value)} rows={4} /></label>
          <label><span>Root Cause</span><textarea value={rootCause} onChange={(event) => setRootCause(event.target.value)} rows={3} /></label>
          <label><span>Parts Replaced</span><textarea value={partsReplaced} onChange={(event) => setPartsReplaced(event.target.value)} rows={3} /></label>
          <div className="confirmation-actions">
            <button className="secondary-button" type="button" onClick={() => setShowResolve(false)}>Cancel</button>
            <button className="primary-button" type="button" disabled={resolveMutation.isPending || resolveDescription.trim().length < 10} onClick={() => resolveMutation.mutate({ resolution_description: resolveDescription, root_cause: rootCause, parts_replaced: partsReplaced })}><CheckCircle2 size={16} /><span>{resolveMutation.isPending ? 'Resolving' : 'Confirm Resolution'}</span></button>
          </div>
          {resolveMutation.error ? <div className="form-error">{getApiErrorMessage(resolveMutation.error)}</div> : null}
        </section>
      )}

      <section className="asset-summary-grid">
        <div className="asset-summary-card"><span>Transformer</span><strong>{getTransformerName(fault.transformer_id)}</strong></div>
        <div className="asset-summary-card"><span>Site</span><strong>{transformerSite(fault.transformer_id)}</strong></div>
        <div className="asset-summary-card"><span>Severity</span><strong>{fault.severity || 'Unrated'}</strong></div>
        <div className="asset-summary-card"><span>Status</span><strong>{displayFaultStatus(fault.fault_status)}</strong></div>
        <div className="asset-summary-card"><span>Reported</span><strong>{formatDate(fault.fault_date || fault.created_at)}</strong></div>
      </section>

      <section className="panel detail-tabs-panel">
        <div className="detail-tabs" role="tablist">
          {tabs.map((tab) => <button className={activeTab === tab.id ? 'active' : undefined} type="button" onClick={() => setActiveTab(tab.id)} key={tab.id}>{tab.label}</button>)}
        </div>
      </section>

      {activeTab === 'overview' && (
        <section className="panel"><div className="panel-heading"><h2>Overview</h2></div><div className="detail-grid">
          <DetailField label="Description" value={readable(fault.fault_description)} />
          <DetailField label="Root Cause" value={readable(fault.root_cause)} />
          <DetailField label="Current Status" value={<span className={faultStatusBadgeClass(fault.fault_status)}>{displayFaultStatus(fault.fault_status)}</span>} />
          <DetailField label="Reported By" value={userName(fault.reported_by)} />
          <DetailField label="Assigned Engineer" value={userName(fault.assigned_to)} />
          <DetailField label="Customers Affected" value={readable(fault.customers_affected)} />
        </div></section>
      )}

      {activeTab === 'transformer' && (
        <section className="panel"><div className="panel-heading"><h2>Transformer</h2></div><div className="detail-grid">
          <DetailField label="Asset ID" value={transformer?.asset_id || 'Not recorded'} />
          <DetailField label="Transformer" value={getTransformerName(fault.transformer_id)} />
          <DetailField label="Site" value={transformerSite(fault.transformer_id)} />
          <DetailField label="Network Voltage" value={transformer?.network_voltage_kv ? `${transformer.network_voltage_kv} kV` : 'Not recorded'} />
          <DetailField label="kVA Rating" value={transformer?.kva_rating ? `${transformer.kva_rating} kVA` : 'Not recorded'} />
        </div>{transformer?._id ? <div className="panel-actions"><Link className="secondary-button" to={`/transformers/${transformer._id}`}>Open Transformer</Link></div> : null}</section>
      )}

      {activeTab === 'timeline' && (
        <section className="panel"><div className="panel-heading"><h2>Incident Timeline</h2></div><div className="timeline-list">
          {rows.map((row) => <div className={`timeline-row ${row.complete ? 'complete' : ''}`} key={row.label}><span className="timeline-marker" /><div><strong>{row.label}</strong><p>{row.complete ? formatDate(row.date) : 'Pending'}</p></div></div>)}
        </div></section>
      )}

      {activeTab === 'resolution' && (
        <section className="panel"><div className="panel-heading"><h2>Resolution</h2></div><div className="detail-grid">
          <DetailField label="Repair Notes" value={readable(fault.resolution_description)} />
          <DetailField label="Root Cause" value={readable(fault.root_cause)} />
          <DetailField label="Parts Replaced" value={readable(fault.parts_replaced)} />
          <DetailField label="Downtime" value={fault.downtime_hours !== undefined ? `${fault.downtime_hours} hours` : 'Not recorded'} />
          <DetailField label="Outage Duration" value={fault.downtime_hours !== undefined ? `${fault.downtime_hours} hours` : 'Not recorded'} />
          <DetailField label="Customers Affected" value={readable(fault.customers_affected)} />
        </div></section>
      )}

      {activeTab === 'inspection' && (
        <section className="panel"><div className="panel-heading"><h2>Related Inspection</h2></div>
          {inspectionQuery.isLoading ? <Loading label="Loading related inspection" /> : inspection ? (
            <div className="detail-grid">
              <DetailField label="Inspection Date" value={formatDate(inspection.inspection_date)} />
              <DetailField label="Condition" value={inspection.physical?.overall_condition || inspection.overall_condition || 'Not recorded'} />
              <DetailField label="Recommended Action" value={inspection.recommended_action || 'Not recorded'} />
              <DetailField label="Narrative" value={inspection.condition_narrative || 'Not recorded'} />
              <div className="panel-actions"><Link className="secondary-button" to={`/inspections/${inspection._id}`}><ClipboardCheck size={16} />Inspection Detail</Link></div>
            </div>
          ) : <EmptyState title="No related inspection" message="This fault was not created from an inspection record." />}
        </section>
      )}
    </div>
  );
}
