import { AlertTriangle, CheckCircle2, Wrench } from 'lucide-react';
import { VehicleIssueReport, VehicleIssueSeverity, VehicleRecord } from '../../types';
import { BTN_PRIMARY, INPUT_CLASS } from './config';

type Props = {
  vehicles: VehicleRecord[];
  vehicleIssues: VehicleIssueReport[];
  newIssue: {
    vehicleId: string;
    severity: VehicleIssueSeverity;
    issueType: string;
    description: string;
  };
  setNewIssue: (value: {
    vehicleId: string;
    severity: VehicleIssueSeverity;
    issueType: string;
    description: string;
  }) => void;
  createVehicleIssue: () => void;
  updateVehicleIssueStatus: (issueId: string, status: 'reported' | 'in_repair' | 'resolved') => void;
};

const SEVERITY_LABEL: Record<VehicleIssueSeverity, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica',
};

const STATUS_LABEL: Record<'reported' | 'in_repair' | 'resolved', string> = {
  reported: 'Reportada',
  in_repair: 'En reparacion',
  resolved: 'Resuelta',
};

const STATUS_TONE: Record<'reported' | 'in_repair' | 'resolved', string> = {
  reported: 'border-red-200 bg-red-50 text-red-700',
  in_repair: 'border-amber-200 bg-amber-50 text-amber-700',
  resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function DriverView({
  vehicles,
  vehicleIssues,
  newIssue,
  setNewIssue,
  createVehicleIssue,
  updateVehicleIssueStatus,
}: Props) {
  const availableVehicles = vehicles.filter((vehicle) => vehicle.isActive);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Unidades en terminal</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{availableVehicles.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">Pendientes o en reparacion</p>
          <p className="mt-2 text-3xl font-black text-amber-900">{vehicleIssues.filter((item) => item.status !== 'resolved').length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">Reportes resueltos</p>
          <p className="mt-2 text-3xl font-black text-emerald-900">{vehicleIssues.filter((item) => item.status === 'resolved').length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createVehicleIssue();
          }}
          className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Reporte de falla</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900">Registrar incidencia de unidad</h3>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <select
              value={newIssue.vehicleId}
              onChange={(event) => setNewIssue({ ...newIssue, vehicleId: event.target.value })}
              className={INPUT_CLASS}
            >
              <option value="">Selecciona vehiculo</option>
              {availableVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plateNumber} · {vehicle.terminalName}
                </option>
              ))}
            </select>
            <select
              value={newIssue.severity}
              onChange={(event) => setNewIssue({ ...newIssue, severity: event.target.value as VehicleIssueSeverity })}
              className={INPUT_CLASS}
            >
              <option value="low">Severidad baja</option>
              <option value="medium">Severidad media</option>
              <option value="high">Severidad alta</option>
              <option value="critical">Severidad critica</option>
            </select>
            <input
              value={newIssue.issueType}
              onChange={(event) => setNewIssue({ ...newIssue, issueType: event.target.value })}
              className={INPUT_CLASS}
              placeholder="Tipo de falla (frenos, luces, motor)"
            />
            <textarea
              value={newIssue.description}
              onChange={(event) => setNewIssue({ ...newIssue, description: event.target.value })}
              className={`${INPUT_CLASS} min-h-28 resize-y`}
              placeholder="Describe sintomas y contexto de la falla"
            />
          </div>

          <button type="submit" className={`${BTN_PRIMARY} mt-4 w-full py-3`}>
            <AlertTriangle className="h-4 w-4" />
            <span>Reportar y enviar a reparacion</span>
          </button>
        </form>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Historial de reportes</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900">Seguimiento de mantenimiento</h3>

          <div className="mt-4 space-y-3">
            {vehicleIssues.length > 0 ? (
              vehicleIssues.map((issue) => (
                <article key={issue.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900">{issue.vehiclePlateNumber} · {issue.issueType}</p>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${STATUS_TONE[issue.status]}`}>
                      {STATUS_LABEL[issue.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{issue.description}</p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Severidad: {SEVERITY_LABEL[issue.severity]} · Reportado por {issue.reportedByName} · {new Date(issue.reportedAt).toLocaleString()}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateVehicleIssueStatus(issue.id, 'in_repair')}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-amber-700"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      En reparacion
                    </button>
                    <button
                      type="button"
                      onClick={() => updateVehicleIssueStatus(issue.id, 'resolved')}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Marcar resuelta
                    </button>
                    <button
                      type="button"
                      onClick={() => updateVehicleIssueStatus(issue.id, 'reported')}
                      className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-red-700"
                    >
                      Reabrir
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                Aun no hay reportes para las unidades de tu terminal.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
