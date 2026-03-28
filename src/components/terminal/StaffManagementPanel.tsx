import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EmployeeSchedule, EmployeeUser, OperationsContextUnit, VehicleRecord, VehicleType } from '../../types';
import { BTN_PRIMARY, INPUT_CLASS } from './config';

type StaffSubTab = 'branches' | 'employees' | 'schedules' | 'vehicles';

type ConfirmPayload = {
  title: string;
  message: string;
  actionLabel: string;
  actionTone?: 'neutral' | 'danger';
  onConfirm: () => void;
};

const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

type Props = {
  selectedBranchId: string;
  setSelectedBranchId: (value: string) => void;
  selectedTerminalId: string;
  setSelectedTerminalId: (value: string) => void;
  operationsContext: OperationsContextUnit[];
  employeeUsers: EmployeeUser[];
  employeeSchedules: EmployeeSchedule[];
  newEmployee: { fullName: string; email: string; password: string; role: 'admin' | 'seller' | 'driver'; branchId: string; terminalId: string };
  setNewEmployee: (value: { fullName: string; email: string; password: string; role: 'admin' | 'seller' | 'driver'; branchId: string; terminalId: string }) => void;
  createEmployee: () => void;
  toggleEmployeeStatus: (employee: EmployeeUser) => void;
  newSchedule: { userId: string; branchId: string; terminalId: string; dayOfWeek: number; startTime: string; endTime: string; notes: string };
  setNewSchedule: (value: { userId: string; branchId: string; terminalId: string; dayOfWeek: number; startTime: string; endTime: string; notes: string }) => void;
  createEmployeeSchedule: () => void;
  deleteEmployeeSchedule: (scheduleId: string) => void;
  newBranch: { code: string; name: string };
  setNewBranch: (value: { code: string; name: string }) => void;
  createBranch: () => void;
  newTerminal: { branchId: string; code: string; name: string };
  setNewTerminal: (value: { branchId: string; code: string; name: string }) => void;
  createTerminal: () => void;
  vehicles: VehicleRecord[];
  newVehicle: {
    branchId: string;
    terminalId: string;
    plateNumber: string;
    internalCode: string;
    vehicleType: VehicleType;
    capacity: number;
    operationalStatus: 'active' | 'maintenance' | 'inactive';
    photoUrl: string;
    notes: string;
    lastInspectionAt: string;
  };
  setNewVehicle: (value: {
    branchId: string;
    terminalId: string;
    plateNumber: string;
    internalCode: string;
    vehicleType: VehicleType;
    capacity: number;
    operationalStatus: 'active' | 'maintenance' | 'inactive';
    photoUrl: string;
    notes: string;
    lastInspectionAt: string;
  }) => void;
  createVehicle: () => void;
  updateVehicleStatus: (vehicleId: string, operationalStatus: 'active' | 'maintenance' | 'inactive') => void;
  requestConfirmation: (payload: ConfirmPayload) => void;
};

export function StaffManagementPanel({
  selectedBranchId,
  setSelectedBranchId,
  selectedTerminalId,
  setSelectedTerminalId,
  operationsContext,
  employeeUsers,
  employeeSchedules,
  newEmployee,
  setNewEmployee,
  createEmployee,
  toggleEmployeeStatus,
  newSchedule,
  setNewSchedule,
  createEmployeeSchedule,
  deleteEmployeeSchedule,
  newBranch,
  setNewBranch,
  createBranch,
  newTerminal,
  setNewTerminal,
  createTerminal,
  vehicles,
  newVehicle,
  setNewVehicle,
  createVehicle,
  updateVehicleStatus,
  requestConfirmation,
}: Props) {
  const [staffTab, setStaffTab] = useState<StaffSubTab>('branches');

  const branchOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    operationsContext.forEach((item) => {
      if (!map.has(item.branchId)) {
        map.set(item.branchId, { id: item.branchId, name: item.branchName, code: item.branchCode });
      }
    });
    return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [operationsContext]);

  const visibleTerminalOptions = useMemo(() => {
    return operationsContext
      .filter((item) => selectedBranchId === 'all' || item.branchId === selectedBranchId)
      .map((item) => ({ id: item.terminalId, name: item.terminalName }));
  }, [operationsContext, selectedBranchId]);

  const employeeTerminalOptions = useMemo(() => {
    return operationsContext.filter((item) => item.branchId === newEmployee.branchId);
  }, [newEmployee.branchId, operationsContext]);

  const scheduleTerminalOptions = useMemo(() => {
    return operationsContext.filter((item) => item.branchId === newSchedule.branchId);
  }, [newSchedule.branchId, operationsContext]);

  const filteredSchedules = useMemo(() => {
    return employeeSchedules.filter((schedule) => {
      const branchOk = selectedBranchId === 'all' || schedule.branchId === selectedBranchId;
      const terminalOk = selectedTerminalId === 'all' || schedule.terminalId === selectedTerminalId;
      return branchOk && terminalOk;
    });
  }, [employeeSchedules, selectedBranchId, selectedTerminalId]);

  const vehicleTerminalOptions = useMemo(() => {
    return operationsContext.filter((item) => item.branchId === newVehicle.branchId);
  }, [newVehicle.branchId, operationsContext]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const branchOk = selectedBranchId === 'all' || vehicle.branchId === selectedBranchId;
      const terminalOk = selectedTerminalId === 'all' || vehicle.terminalId === selectedTerminalId;
      return branchOk && terminalOk;
    });
  }, [vehicles, selectedBranchId, selectedTerminalId]);

  const vehicleSummary = useMemo(() => {
    const total = filteredVehicles.length;
    const active = filteredVehicles.filter((vehicle) => vehicle.operationalStatus === 'active' && vehicle.isActive).length;
    const maintenance = filteredVehicles.filter((vehicle) => vehicle.operationalStatus === 'maintenance' && vehicle.isActive).length;
    const inactive = filteredVehicles.filter((vehicle) => vehicle.operationalStatus === 'inactive' || !vehicle.isActive).length;
    return { total, active, maintenance, inactive };
  }, [filteredVehicles]);

  const vehiclesByTerminal = useMemo(() => {
    const map = new Map<string, { key: string; label: string; active: number; maintenance: number; inactive: number }>();
    filteredVehicles.forEach((vehicle) => {
      const key = `${vehicle.branchName}::${vehicle.terminalName}`;
      if (!map.has(key)) {
        map.set(key, { key, label: `${vehicle.branchName} / ${vehicle.terminalName}`, active: 0, maintenance: 0, inactive: 0 });
      }
      const target = map.get(key);
      if (!target) return;
      if (vehicle.operationalStatus === 'active' && vehicle.isActive) target.active += 1;
      else if (vehicle.operationalStatus === 'maintenance' && vehicle.isActive) target.maintenance += 1;
      else target.inactive += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.active - a.active || a.label.localeCompare(b.label));
  }, [filteredVehicles]);

  return (
    <div className="space-y-5">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Organizacion por tabs</p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Personal, sucursales y horarios</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStaffTab('branches')}
              className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em] ${staffTab === 'branches' ? 'bg-[#0f7666] text-white' : 'border border-slate-200 text-slate-700'}`}
            >
              Sucursales y terminales
            </button>
            <button
              type="button"
              onClick={() => setStaffTab('employees')}
              className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em] ${staffTab === 'employees' ? 'bg-[#0f7666] text-white' : 'border border-slate-200 text-slate-700'}`}
            >
              Empleados
            </button>
            <button
              type="button"
              onClick={() => setStaffTab('schedules')}
              className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em] ${staffTab === 'schedules' ? 'bg-[#0f7666] text-white' : 'border border-slate-200 text-slate-700'}`}
            >
              Horarios
            </button>
            <button
              type="button"
              onClick={() => setStaffTab('vehicles')}
              className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em] ${staffTab === 'vehicles' ? 'bg-[#0f7666] text-white' : 'border border-slate-200 text-slate-700'}`}
            >
              Vehiculos
            </button>
          </div>
        </div>

        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Filtro operativo</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            value={selectedBranchId}
            onChange={(event) => setSelectedBranchId(event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="all">Todas las sucursales</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
          <select
            value={selectedTerminalId}
            onChange={(event) => setSelectedTerminalId(event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="all">Todas las terminales</option>
            {visibleTerminalOptions.map((terminal) => (
              <option key={terminal.id} value={terminal.id}>{terminal.name}</option>
            ))}
          </select>
        </div>
      </div>

      {staffTab === 'branches' && (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              requestConfirmation({
                title: 'Crear sucursal',
                message: `Se registrara la sucursal ${newBranch.name || '-'}.`,
                actionLabel: 'Crear sucursal',
                onConfirm: createBranch,
              });
            }}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Alta de sucursal</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input value={newBranch.code} onChange={(event) => setNewBranch({ ...newBranch, code: event.target.value })} className={INPUT_CLASS} placeholder="Clave (ej. OAX-CTR)" />
              <input value={newBranch.name} onChange={(event) => setNewBranch({ ...newBranch, name: event.target.value })} className={INPUT_CLASS} placeholder="Nombre sucursal" />
            </div>
            <button type="submit" className={`${BTN_PRIMARY} mt-4 w-full py-3`}>
              <Plus className="h-4 w-4" />
              <span>Guardar sucursal</span>
            </button>
          </form>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              requestConfirmation({
                title: 'Crear terminal',
                message: `Se registrara la terminal ${newTerminal.name || '-'} en la sucursal seleccionada.`,
                actionLabel: 'Crear terminal',
                onConfirm: createTerminal,
              });
            }}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Alta de terminal</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <select value={newTerminal.branchId} onChange={(event) => setNewTerminal({ ...newTerminal, branchId: event.target.value })} className={INPUT_CLASS}>
                <option value="">Sucursal</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
              <input value={newTerminal.code} onChange={(event) => setNewTerminal({ ...newTerminal, code: event.target.value })} className={INPUT_CLASS} placeholder="Clave" />
              <input value={newTerminal.name} onChange={(event) => setNewTerminal({ ...newTerminal, name: event.target.value })} className={INPUT_CLASS} placeholder="Nombre terminal" />
            </div>
            <button type="submit" className={`${BTN_PRIMARY} mt-4 w-full py-3`}>
              <Plus className="h-4 w-4" />
              <span>Guardar terminal</span>
            </button>
          </form>
        </div>
      )}

      {staffTab === 'employees' && (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              requestConfirmation({
                title: 'Crear empleado',
                message: `Se creara el usuario ${newEmployee.fullName || '-'} en la sucursal seleccionada.`,
                actionLabel: 'Crear empleado',
                onConfirm: createEmployee,
              });
            }}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Alta de empleado</p>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <input value={newEmployee.fullName} onChange={(event) => setNewEmployee({ ...newEmployee, fullName: event.target.value })} className={INPUT_CLASS} placeholder="Nombre completo" />
              <input value={newEmployee.email} onChange={(event) => setNewEmployee({ ...newEmployee, email: event.target.value })} className={INPUT_CLASS} placeholder={newEmployee.role === 'driver' ? 'Correo (opcional para chofer)' : 'Correo'} />
              <input type="password" value={newEmployee.password} onChange={(event) => setNewEmployee({ ...newEmployee, password: event.target.value })} className={INPUT_CLASS} placeholder={newEmployee.role === 'driver' ? 'Contrasena (opcional para chofer)' : 'Contrasena temporal (min 10)'} />
              <select value={newEmployee.role} onChange={(event) => setNewEmployee({ ...newEmployee, role: event.target.value as 'admin' | 'seller' | 'driver' })} className={INPUT_CLASS}>
                <option value="seller">Empleado vendedor</option>
                <option value="driver">Chofer</option>
                <option value="admin">Administrador</option>
              </select>
              {newEmployee.role === 'driver' && (
                <p className="text-xs font-semibold text-emerald-700">Al crear chofer se generan usuario y contrasena automaticamente.</p>
              )}
              <select
                value={newEmployee.branchId}
                onChange={(event) => {
                  const branchId = event.target.value;
                  const firstTerminal = operationsContext.find((item) => item.branchId === branchId)?.terminalId ?? '';
                  setNewEmployee({ ...newEmployee, branchId, terminalId: firstTerminal });
                }}
                className={INPUT_CLASS}
              >
                <option value="">Sucursal</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
              <select value={newEmployee.terminalId} onChange={(event) => setNewEmployee({ ...newEmployee, terminalId: event.target.value })} className={INPUT_CLASS}>
                <option value="">Terminal</option>
                {employeeTerminalOptions.map((terminal) => (
                  <option key={terminal.terminalId} value={terminal.terminalId}>{terminal.terminalName}</option>
                ))}
              </select>
            </div>
            <button type="submit" className={`${BTN_PRIMARY} mt-4 w-full py-3`}>
              <Plus className="h-4 w-4" />
              <span>Guardar empleado</span>
            </button>
          </form>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Plantilla</p>
            <div className="mt-4 space-y-3">
              {employeeUsers.map((employee) => (
                <div key={employee.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-slate-900">{employee.fullName}</p>
                      <p className="text-xs text-slate-500">{employee.email} · {employee.branchName} · {employee.terminalName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleEmployeeStatus(employee)}
                      className={`rounded-lg border px-3 py-1 text-xs font-black uppercase tracking-[0.1em] ${employee.isActive ? 'border-amber-200 text-amber-700' : 'border-emerald-200 text-emerald-700'}`}
                    >
                      {employee.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {staffTab === 'schedules' && (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              requestConfirmation({
                title: 'Asignar horario',
                message: `Se asignara horario de ${newSchedule.startTime} a ${newSchedule.endTime}.`,
                actionLabel: 'Asignar horario',
                onConfirm: createEmployeeSchedule,
              });
            }}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Horario por empleado</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <select value={newSchedule.userId} onChange={(event) => setNewSchedule({ ...newSchedule, userId: event.target.value })} className={`${INPUT_CLASS} md:col-span-2`}>
                <option value="">Empleado</option>
                {employeeUsers.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.email}</option>
                ))}
              </select>
              <select
                value={newSchedule.branchId}
                onChange={(event) => {
                  const branchId = event.target.value;
                  const firstTerminal = operationsContext.find((item) => item.branchId === branchId)?.terminalId ?? '';
                  setNewSchedule({ ...newSchedule, branchId, terminalId: firstTerminal });
                }}
                className={INPUT_CLASS}
              >
                <option value="">Sucursal</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
              <select value={newSchedule.terminalId} onChange={(event) => setNewSchedule({ ...newSchedule, terminalId: event.target.value })} className={INPUT_CLASS}>
                <option value="">Terminal</option>
                {scheduleTerminalOptions.map((terminal) => (
                  <option key={terminal.terminalId} value={terminal.terminalId}>{terminal.terminalName}</option>
                ))}
              </select>
              <select value={newSchedule.dayOfWeek} onChange={(event) => setNewSchedule({ ...newSchedule, dayOfWeek: Number.parseInt(event.target.value, 10) })} className={INPUT_CLASS}>
                {WEEKDAY_LABELS.map((label, index) => (
                  <option key={label} value={index}>{label}</option>
                ))}
              </select>
              <input type="time" value={newSchedule.startTime} onChange={(event) => setNewSchedule({ ...newSchedule, startTime: event.target.value })} className={INPUT_CLASS} />
              <input type="time" value={newSchedule.endTime} onChange={(event) => setNewSchedule({ ...newSchedule, endTime: event.target.value })} className={INPUT_CLASS} />
              <textarea value={newSchedule.notes} onChange={(event) => setNewSchedule({ ...newSchedule, notes: event.target.value })} className={`${INPUT_CLASS} min-h-20 resize-y md:col-span-2`} placeholder="Notas del turno (opcional)" />
            </div>
            <button type="submit" className={`${BTN_PRIMARY} mt-4 w-full py-3`}>
              <Plus className="h-4 w-4" />
              <span>Guardar horario</span>
            </button>
          </form>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Horarios asignados</p>
            <div className="mt-5 space-y-3">
              {filteredSchedules.length > 0 ? (
                filteredSchedules.map((schedule) => (
                  <div key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">{schedule.employeeName}</p>
                      <p className="text-xs text-slate-500">{WEEKDAY_LABELS[schedule.dayOfWeek] ?? 'Dia'} · {schedule.startTime} - {schedule.endTime} · {schedule.branchName} / {schedule.terminalName}</p>
                      {schedule.notes && <p className="mt-1 text-xs text-slate-600">Nota: {schedule.notes}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        requestConfirmation({
                          title: 'Eliminar horario',
                          message: `Se eliminara el horario de ${schedule.employeeName}.`,
                          actionLabel: 'Eliminar',
                          actionTone: 'danger',
                          onConfirm: () => deleteEmployeeSchedule(schedule.id),
                        })
                      }
                      className="rounded-xl border border-red-200 px-3 py-2 text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                  Aun no hay horarios para este filtro.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {staffTab === 'vehicles' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Total</p><p className="mt-1 text-2xl font-black text-slate-900">{vehicleSummary.total}</p></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">Activos</p><p className="mt-1 text-2xl font-black text-emerald-900">{vehicleSummary.active}</p></div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">Mantenimiento</p><p className="mt-1 text-2xl font-black text-amber-900">{vehicleSummary.maintenance}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Inactivos</p><p className="mt-1 text-2xl font-black text-slate-900">{vehicleSummary.inactive}</p></div>
          </div>

          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Vehiculos funcionando por terminal</p>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {vehiclesByTerminal.length > 0 ? (
                vehiclesByTerminal.map((item) => (
                  <div key={item.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <p className="font-black text-slate-800">{item.label}</p>
                    <p className="mt-1 text-slate-600">Activos: {item.active} · Mantenimiento: {item.maintenance} · Inactivos: {item.inactive}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Sin datos de terminal en el filtro actual.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                requestConfirmation({
                  title: 'Registrar vehiculo',
                  message: `Se registrara la unidad con placa ${newVehicle.plateNumber || '-'}.`,
                  actionLabel: 'Guardar vehiculo',
                  onConfirm: createVehicle,
                });
              }}
              className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Alta de vehiculo</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  value={newVehicle.branchId}
                  onChange={(event) => {
                    const branchId = event.target.value;
                    const firstTerminal = operationsContext.find((item) => item.branchId === branchId)?.terminalId ?? '';
                    setNewVehicle({ ...newVehicle, branchId, terminalId: firstTerminal });
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="">Sucursal</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
                <select value={newVehicle.terminalId} onChange={(event) => setNewVehicle({ ...newVehicle, terminalId: event.target.value })} className={INPUT_CLASS}>
                  <option value="">Terminal</option>
                  {vehicleTerminalOptions.map((terminal) => (
                    <option key={terminal.terminalId} value={terminal.terminalId}>{terminal.terminalName}</option>
                  ))}
                </select>
                <input value={newVehicle.plateNumber} onChange={(event) => setNewVehicle({ ...newVehicle, plateNumber: event.target.value })} className={INPUT_CLASS} placeholder="Placa" />
                <input value={newVehicle.internalCode} onChange={(event) => setNewVehicle({ ...newVehicle, internalCode: event.target.value })} className={INPUT_CLASS} placeholder="Codigo interno" />
                <select value={newVehicle.vehicleType} onChange={(event) => setNewVehicle({ ...newVehicle, vehicleType: event.target.value as VehicleType })} className={INPUT_CLASS}>
                  <option value="sprinter">Sprinter</option>
                  <option value="minibus">Minibus</option>
                  <option value="autobus">Autobus</option>
                  <option value="autobus_xl">Autobus XL</option>
                </select>
                <input type="number" min={4} max={80} value={newVehicle.capacity} onChange={(event) => setNewVehicle({ ...newVehicle, capacity: Number.parseInt(event.target.value || '40', 10) })} className={INPUT_CLASS} placeholder="Capacidad" />
                <select value={newVehicle.operationalStatus} onChange={(event) => setNewVehicle({ ...newVehicle, operationalStatus: event.target.value as 'active' | 'maintenance' | 'inactive' })} className={INPUT_CLASS}>
                  <option value="active">Activo</option>
                  <option value="maintenance">Mantenimiento</option>
                  <option value="inactive">Inactivo</option>
                </select>
                <input type="date" value={newVehicle.lastInspectionAt} onChange={(event) => setNewVehicle({ ...newVehicle, lastInspectionAt: event.target.value })} className={INPUT_CLASS} />
                <input value={newVehicle.photoUrl} onChange={(event) => setNewVehicle({ ...newVehicle, photoUrl: event.target.value })} className={`${INPUT_CLASS} md:col-span-2`} placeholder="URL de foto (opcional)" />
                <textarea value={newVehicle.notes} onChange={(event) => setNewVehicle({ ...newVehicle, notes: event.target.value })} className={`${INPUT_CLASS} min-h-20 resize-y md:col-span-2`} placeholder="Observaciones del vehiculo" />
              </div>
              <button type="submit" className={`${BTN_PRIMARY} mt-4 w-full py-3`}>
                <Plus className="h-4 w-4" />
                <span>Guardar vehiculo</span>
              </button>
            </form>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Flotilla registrada</p>
              <div className="mt-4 space-y-3">
                {filteredVehicles.length > 0 ? (
                  filteredVehicles.map((vehicle) => (
                    <div key={vehicle.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900">{vehicle.plateNumber}</p>
                          <p className="text-xs text-slate-500">{vehicle.branchName} / {vehicle.terminalName} · {vehicle.vehicleType} · {vehicle.capacity} asientos</p>
                          {vehicle.internalCode && <p className="text-xs text-slate-500">Codigo: {vehicle.internalCode}</p>}
                          {vehicle.notes && <p className="mt-1 text-xs text-slate-600">{vehicle.notes}</p>}
                        </div>
                        {vehicle.photoUrl ? <img src={vehicle.photoUrl} alt={vehicle.plateNumber} className="h-14 w-20 rounded-lg object-cover" /> : <div className="h-14 w-20 rounded-lg border border-dashed border-slate-300 bg-white text-[10px] font-bold text-slate-400 grid place-items-center">Sin foto</div>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => updateVehicleStatus(vehicle.id, 'active')} className="rounded-lg border border-emerald-200 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-700">Activo</button>
                        <button type="button" onClick={() => updateVehicleStatus(vehicle.id, 'maintenance')} className="rounded-lg border border-amber-200 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-700">Mantenimiento</button>
                        <button type="button" onClick={() => updateVehicleStatus(vehicle.id, 'inactive')} className="rounded-lg border border-slate-300 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-700">Inactivo</button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                    Aun no hay vehiculos registrados para este filtro.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
