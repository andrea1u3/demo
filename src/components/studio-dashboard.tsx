"use client";

import {
  Activity,
  CalendarDays,
  Check,
  CircleAlert,
  ClipboardCheck,
  Minus,
  Plus,
  RotateCcw,
  Save,
  UserPlus,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { usePersistentStudioState } from "@/hooks/use-persistent-studio-state";
import {
  addToWaitlist,
  adjustChannelQuota,
  buildActions,
  cancelChannelReservation,
  checkInChannelReservation,
  checkedInTotal,
  convertWaitlist,
  createClassSession,
  createCustomer,
  type OperationResult,
  reserveSpot,
  reservedTotal,
  toggleChannel
} from "@/lib/studio-rules";
import type { ChannelCode, ClassSession } from "@/lib/types";
import { cn, formatPercent } from "@/lib/utils";

type ReservationForm = {
  sessionId: string;
  channelCode: ChannelCode;
  customerId: string;
};

type CustomerForm = {
  fullName: string;
  phone: string;
};

type ClassForm = {
  title: string;
  startsAt: string;
  coach: string;
  capacity: number;
  quotas: Record<ChannelCode, number>;
};

const channelLabels: Record<ChannelCode, string> = {
  direct: "Directo",
  whatsapp: "WhatsApp",
  fitpass: "Fitpass",
  totalpass: "TotalPass",
  wellhub: "Wellhub"
};

const emptyCustomerForm: CustomerForm = {
  fullName: "",
  phone: ""
};

const defaultClassForm: ClassForm = {
  title: "Reformer Flow",
  startsAt: "16:00",
  coach: "Mariana",
  capacity: 10,
  quotas: {
    direct: 6,
    whatsapp: 2,
    fitpass: 1,
    totalpass: 1,
    wellhub: 0
  }
};

export function StudioDashboard() {
  const { state, setState, reset, loaded } = usePersistentStudioState();
  const { sessions, customers } = state;
  const [reservationForm, setReservationForm] = useState<ReservationForm>({
    sessionId: sessions[1]?.id ?? sessions[0]?.id ?? "",
    channelCode: "direct",
    customerId: customers[0]?.id ?? ""
  });
  const [customerForm, setCustomerForm] = useState<CustomerForm>(emptyCustomerForm);
  const [classForm, setClassForm] = useState<ClassForm>(defaultClassForm);
  const [message, setMessage] = useState("Demo viva: las operaciones se guardan en este navegador.");

  const selectedSession = sessions.find((session) => session.id === reservationForm.sessionId) ?? sessions[0];
  const availableChannels = selectedSession?.quotas ?? [];

  const safeReservationForm = useMemo(() => {
    const sessionId = selectedSession?.id ?? "";
    const channelExists = availableChannels.some((quota) => quota.code === reservationForm.channelCode);
    return {
      sessionId,
      channelCode: channelExists ? reservationForm.channelCode : availableChannels[0]?.code ?? "direct",
      customerId: customers.some((customer) => customer.id === reservationForm.customerId)
        ? reservationForm.customerId
        : customers[0]?.id ?? ""
    };
  }, [availableChannels, customers, reservationForm, selectedSession]);

  const totals = useMemo(() => {
    const capacity = sessions.reduce((sum, session) => sum + session.capacity, 0);
    const reserved = sessions.reduce((sum, session) => sum + reservedTotal(session), 0);
    const checkedIn = sessions.reduce((sum, session) => sum + checkedInTotal(session), 0);
    return { capacity, reserved, checkedIn };
  }, [sessions]);

  const actions = useMemo(() => buildActions(sessions), [sessions]);

  function applyOperation(result: OperationResult) {
    setState(result.state);
    setMessage(result.message);
  }

  function handleReserve() {
    applyOperation(
      reserveSpot(state, {
        sessionId: safeReservationForm.sessionId,
        channelCode: safeReservationForm.channelCode,
        customerId: safeReservationForm.customerId
      })
    );
  }

  function handleCreateCustomer() {
    const result = createCustomer(state, customerForm);
    applyOperation(result);
    if (result.ok) {
      setCustomerForm(emptyCustomerForm);
      setReservationForm((current) => ({
        ...current,
        customerId: result.state.customers[result.state.customers.length - 1]?.id ?? current.customerId
      }));
    }
  }

  function handleCreateClass() {
    const result = createClassSession(state, classForm);
    applyOperation(result);
    if (result.ok) {
      const createdSession = result.state.sessions.find((session) => session.startsAt === classForm.startsAt && session.title === classForm.title);
      setReservationForm((current) => ({
        ...current,
        sessionId: createdSession?.id ?? current.sessionId,
        channelCode: createdSession?.quotas[0]?.code ?? current.channelCode
      }));
    }
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">Studio Ops</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Control diario de cupos y ocupacion</h1>
            <p className="mt-1 text-sm text-slate-500">
              {loaded ? "Persistencia local activa." : "Cargando datos..."} Luego conectamos esta capa a Supabase.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900"
              onClick={() => {
                reset();
                setMessage("Demo reiniciada.");
              }}
            >
              <RotateCcw size={18} />
              Reiniciar demo
            </button>
            <button
              className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white"
              onClick={handleReserve}
            >
              <UserPlus size={18} />
              Confirmar reserva
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[1fr_400px]">
        <section className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              icon={<CalendarDays size={20} />}
              label="Ocupacion reservada"
              value={formatPercent(totals.capacity ? totals.reserved / totals.capacity : 0)}
              detail={`${totals.reserved} de ${totals.capacity} lugares hoy`}
            />
            <MetricCard
              icon={<ClipboardCheck size={20} />}
              label="Asistencia real"
              value={formatPercent(totals.capacity ? totals.checkedIn / totals.capacity : 0)}
              detail={`${totals.checkedIn} check-ins registrados`}
            />
            <MetricCard icon={<CircleAlert size={20} />} label="Sobrecupos" value="0" detail="Bloqueado por reglas de cupo" />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Clases de hoy</h2>
                <p className="text-sm text-slate-500">Opera reservas, cupos, check-ins, cancelaciones y waitlist por canal.</p>
              </div>
              <button
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
                onClick={handleCreateClass}
              >
                <Plus size={16} />
                Crear clase rapida
              </button>
            </div>

            <div className="divide-y divide-slate-200">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onUse={() =>
                    setReservationForm((current) => ({
                      ...current,
                      sessionId: session.id,
                      channelCode: session.quotas[0]?.code ?? "direct"
                    }))
                  }
                  onCheckIn={(channelCode) => applyOperation(checkInChannelReservation(state, session.id, channelCode))}
                  onCancel={(channelCode) => applyOperation(cancelChannelReservation(state, session.id, channelCode))}
                  onToggle={(channelCode) => applyOperation(toggleChannel(state, session.id, channelCode))}
                  onQuotaDelta={(channelCode, delta) => applyOperation(adjustChannelQuota(state, session.id, channelCode, delta))}
                  onAddWaitlist={() => applyOperation(addToWaitlist(state, session.id))}
                  onConvertWaitlist={() => applyOperation(convertWaitlist(state, session.id))}
                />
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <Panel title="Nueva reserva" subtitle="Valida cupo global y cuota por canal.">
            <div className="space-y-3">
              <Field label="Clase">
                <select
                  className="focus-ring h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={safeReservationForm.sessionId}
                  onChange={(event) => {
                    const session = sessions.find((item) => item.id === event.target.value);
                    setReservationForm((current) => ({
                      ...current,
                      sessionId: event.target.value,
                      channelCode: session?.quotas[0]?.code ?? "direct"
                    }));
                  }}
                >
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.startsAt} - {session.title}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Canal">
                <select
                  className="focus-ring h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={safeReservationForm.channelCode}
                  onChange={(event) => setReservationForm((current) => ({ ...current, channelCode: event.target.value as ChannelCode }))}
                >
                  {availableChannels.map((quota) => (
                    <option key={quota.code} value={quota.code}>
                      {channelLabels[quota.code]} - {quota.reserved}/{quota.quota}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Cliente">
                <select
                  className="focus-ring h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={safeReservationForm.customerId}
                  onChange={(event) => setReservationForm((current) => ({ ...current, customerId: event.target.value }))}
                >
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.fullName} - {customer.status}
                    </option>
                  ))}
                </select>
              </Field>

              <button className="focus-ring h-10 w-full rounded-md bg-blue-700 text-sm font-semibold text-white" onClick={handleReserve}>
                Validar cupo y confirmar
              </button>
            </div>

            <div className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm leading-5 text-slate-700">{message}</div>
          </Panel>

          <Panel title="Crear cliente" subtitle="Evita duplicados por telefono.">
            <div className="space-y-3">
              <Field label="Nombre">
                <input
                  className="focus-ring h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={customerForm.fullName}
                  onChange={(event) => setCustomerForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Nombre completo"
                />
              </Field>
              <Field label="Telefono">
                <input
                  className="focus-ring h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={customerForm.phone}
                  onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+52 55..."
                />
              </Field>
              <button className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 text-sm font-semibold" onClick={handleCreateCustomer}>
                <Save size={16} />
                Guardar cliente
              </button>
            </div>
          </Panel>

          <Panel title="Crear clase" subtitle="La suma de cupos no puede superar la capacidad.">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hora">
                  <input
                    className="focus-ring h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    value={classForm.startsAt}
                    onChange={(event) => setClassForm((current) => ({ ...current, startsAt: event.target.value }))}
                  />
                </Field>
                <Field label="Cupo">
                  <input
                    className="focus-ring h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    type="number"
                    min={1}
                    value={classForm.capacity}
                    onChange={(event) => setClassForm((current) => ({ ...current, capacity: Number(event.target.value) }))}
                  />
                </Field>
              </div>
              <Field label="Clase">
                <input
                  className="focus-ring h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={classForm.title}
                  onChange={(event) => setClassForm((current) => ({ ...current, title: event.target.value }))}
                />
              </Field>
              <Field label="Coach">
                <input
                  className="focus-ring h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={classForm.coach}
                  onChange={(event) => setClassForm((current) => ({ ...current, coach: event.target.value }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(channelLabels) as ChannelCode[]).map((code) => (
                  <Field key={code} label={channelLabels[code]}>
                    <input
                      className="focus-ring h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                      type="number"
                      min={0}
                      value={classForm.quotas[code]}
                      onChange={(event) =>
                        setClassForm((current) => ({
                          ...current,
                          quotas: { ...current.quotas, [code]: Number(event.target.value) }
                        }))
                      }
                    />
                  </Field>
                ))}
              </div>
              <button className="focus-ring h-10 w-full rounded-md bg-slate-950 text-sm font-semibold text-white" onClick={handleCreateClass}>
                Crear clase
              </button>
            </div>
          </Panel>

          <Panel title="Acciones de hoy" subtitle="Calculadas desde el estado actual.">
            <div className="-mx-4 -mb-4 divide-y divide-slate-200">
              {actions.length ? (
                actions.map((action) => (
                  <div key={action.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-1 h-2.5 w-2.5 rounded-full",
                          action.priority === "high" && "bg-red-500",
                          action.priority === "medium" && "bg-amber-500",
                          action.priority === "low" && "bg-blue-500"
                        )}
                      />
                      <div>
                        <p className="font-medium text-slate-950">{action.label}</p>
                        <p className="mt-1 text-sm leading-5 text-slate-500">{action.detail}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-slate-500">No hay acciones pendientes.</div>
              )}
            </div>
          </Panel>

          <Panel title="Auditoria" subtitle="Ultimos cambios operativos.">
            <div className="-mx-4 -mb-4 divide-y divide-slate-200">
              {state.auditLog.slice(0, 6).map((event) => (
                <div key={event.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-950">{event.action}</p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{event.detail}</p>
                </div>
              ))}
            </div>
          </Panel>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-slate-950">
              <Activity size={18} />
              <h2 className="font-semibold">Meta piloto</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Subir +10% ocupacion real en 60 dias, bajar no-shows y mantener 0 sobrecupos.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function SessionCard({
  session,
  onUse,
  onCheckIn,
  onCancel,
  onToggle,
  onQuotaDelta,
  onAddWaitlist,
  onConvertWaitlist
}: {
  session: ClassSession;
  onUse: () => void;
  onCheckIn: (channelCode: ChannelCode) => void;
  onCancel: (channelCode: ChannelCode) => void;
  onToggle: (channelCode: ChannelCode) => void;
  onQuotaDelta: (channelCode: ChannelCode, delta: number) => void;
  onAddWaitlist: () => void;
  onConvertWaitlist: () => void;
}) {
  const reserved = reservedTotal(session);
  const checkedIn = checkedInTotal(session);
  const occupancy = reserved / session.capacity;

  return (
    <article className="p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-1 text-sm font-semibold">{session.startsAt}</span>
            <h3 className="text-lg font-semibold text-slate-950">{session.title}</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {session.coach} - {session.room} - {reserved}/{session.capacity} reservados - {checkedIn} check-ins
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={occupancy} />
          <button className="focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm font-medium" onClick={onUse}>
            Usar para reserva
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {session.quotas.map((quota) => (
          <div key={quota.code} className={cn("rounded-md border p-3", quota.closed ? "border-slate-300 bg-slate-50" : "border-slate-200")}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">{quota.name}</p>
              <p className="text-sm font-semibold text-slate-950">
                {quota.reserved}/{quota.quota}
              </p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div
                className={cn("h-2 rounded-full", quota.closed ? "bg-slate-400" : quota.reserved >= quota.quota ? "bg-red-500" : "bg-blue-600")}
                style={{ width: `${Math.min(100, quota.quota ? (quota.reserved / quota.quota) * 100 : 0)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {quota.checkedIn} check-ins - {quota.closed ? "cerrado" : quota.reserved >= quota.quota ? "lleno" : "abierto"}
            </p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              <IconButton label="Subir cupo" onClick={() => onQuotaDelta(quota.code, 1)}>
                <Plus size={15} />
              </IconButton>
              <IconButton label="Bajar cupo" onClick={() => onQuotaDelta(quota.code, -1)}>
                <Minus size={15} />
              </IconButton>
              <IconButton label="Check-in" onClick={() => onCheckIn(quota.code)}>
                <Check size={15} />
              </IconButton>
              <IconButton label="Cancelar" onClick={() => onCancel(quota.code)}>
                <X size={15} />
              </IconButton>
              <IconButton label={quota.closed ? "Abrir canal" : "Cerrar canal"} onClick={() => onToggle(quota.code)}>
                <RotateCcw size={15} />
              </IconButton>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-950 md:flex-row md:items-center md:justify-between">
        <span>Waitlist: {session.waitlist} clientes esperando.</span>
        <div className="flex gap-2">
          <button className="focus-ring rounded-md bg-white px-3 py-1.5 font-medium text-amber-950" onClick={onAddWaitlist}>
            Agregar
          </button>
          <button className="focus-ring rounded-md bg-amber-900 px-3 py-1.5 font-medium text-white" onClick={onConvertWaitlist}>
            Convertir
          </button>
        </div>
      </div>
    </article>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-slate-500">
        <p className="text-sm font-medium">{label}</p>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function StatusBadge({ value }: { value: number }) {
  const label = value >= 1 ? "Lleno" : value >= 0.7 ? "Alto" : "Huecos";
  return (
    <span
      className={cn(
        "rounded-md px-2.5 py-1 text-sm font-medium",
        value >= 1 && "bg-red-50 text-red-700",
        value >= 0.7 && value < 1 && "bg-emerald-50 text-emerald-700",
        value < 0.7 && "bg-amber-50 text-amber-700"
      )}
    >
      {label} - {formatPercent(value)}
    </span>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className="focus-ring inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
