import type { AuditEvent, ChannelCode, ClassSession, Customer, DailyAction, ReservationRecord, StudioState } from "./types";
import { formatPercent } from "./utils";

export type OperationResult =
  | { ok: true; state: StudioState; message: string }
  | { ok: false; state: StudioState; message: string };

export function reservedTotal(session: ClassSession) {
  return session.quotas.reduce((sum, quota) => sum + quota.reserved, 0);
}

export function checkedInTotal(session: ClassSession) {
  return session.quotas.reduce((sum, quota) => sum + quota.checkedIn, 0);
}

export function buildActions(sessions: ClassSession[]): DailyAction[] {
  const lowOccupancy = sessions.filter((session) => reservedTotal(session) / session.capacity < 0.7);
  const waitlists = sessions.filter((session) => session.waitlist > 0);
  const fullChannels = sessions.flatMap((session) =>
    session.quotas
      .filter((quota) => quota.quota > 0 && quota.reserved >= quota.quota)
      .map((quota) => ({ session, quota }))
  );

  return [
    ...lowOccupancy.map((session) => ({
      id: `low_${session.id}`,
      label: `Llenar clase de ${session.startsAt}`,
      detail: `Ocupacion reservada ${formatPercent(reservedTotal(session) / session.capacity)}. Hay ${session.capacity - reservedTotal(session)} lugares libres.`,
      priority: "high" as const
    })),
    ...waitlists.map((session) => ({
      id: `wait_${session.id}`,
      label: `Revisar waitlist de ${session.startsAt}`,
      detail: `${session.waitlist} clientes esperando. Convierte solo si hay cupo directo real.`,
      priority: "medium" as const
    })),
    ...fullChannels.slice(0, 3).map(({ session, quota }) => ({
      id: `full_${session.id}_${quota.code}`,
      label: `${quota.name} lleno a las ${session.startsAt}`,
      detail: "No tomes cupo de otro canal sin mover cuota manualmente.",
      priority: "medium" as const
    }))
  ].slice(0, 8);
}

export function addAuditEvent(state: StudioState, action: string, detail: string): StudioState {
  const event: AuditEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    action,
    detail,
    createdAt: new Date().toISOString()
  };

  return {
    ...state,
    auditLog: [event, ...state.auditLog].slice(0, 25)
  };
}

export function createCustomer(state: StudioState, input: { fullName: string; phone: string }): OperationResult {
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();

  if (!fullName || !phone) {
    return { ok: false, state, message: "Nombre y telefono son obligatorios." };
  }

  const duplicated = state.customers.some((customer) => normalizePhone(customer.phone) === normalizePhone(phone));
  if (duplicated) {
    return { ok: false, state, message: "Ese telefono ya existe. No dupliques clientes." };
  }

  const customer: Customer = {
    id: `cus_${Date.now()}`,
    fullName,
    phone,
    status: "active"
  };
  const nextState = addAuditEvent(
    { ...state, customers: [...state.customers, customer] },
    "customer.created",
    `${fullName} agregado a clientes.`
  );

  return { ok: true, state: nextState, message: `Cliente creado: ${fullName}.` };
}

export function createClassSession(
  state: StudioState,
  input: {
    title: string;
    startsAt: string;
    coach: string;
    capacity: number;
    quotas: Record<ChannelCode, number>;
  }
): OperationResult {
  const title = input.title.trim();
  const startsAt = input.startsAt.trim();
  const coach = input.coach.trim();
  const capacity = Number(input.capacity);
  const quotaEntries = Object.entries(input.quotas) as Array<[ChannelCode, number]>;
  const quotaSum = quotaEntries.reduce((sum, [, value]) => sum + Number(value), 0);

  if (!title || !startsAt || !coach) {
    return { ok: false, state, message: "Clase, hora y coach son obligatorios." };
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    return { ok: false, state, message: "La capacidad debe ser un entero positivo." };
  }

  if (quotaEntries.some(([, value]) => !Number.isInteger(Number(value)) || Number(value) < 0)) {
    return { ok: false, state, message: "Los cupos por canal no pueden ser negativos." };
  }

  if (quotaSum <= 0) {
    return { ok: false, state, message: "La clase necesita al menos un cupo asignado a un canal." };
  }

  if (quotaSum > capacity) {
    return { ok: false, state, message: "La suma de cupos por canal no puede superar el cupo total." };
  }

  const session: ClassSession = {
    id: `cls_${Date.now()}`,
    title,
    startsAt,
    coach,
    room: "Sala A",
    capacity,
    waitlist: 0,
    quotas: quotaEntries
      .filter(([, quota]) => quota > 0)
      .map(([code, quota]) => ({
        code,
        name: channelName(code),
        quota,
        reserved: 0,
        checkedIn: 0
      }))
  };
  const nextState = addAuditEvent(
    { ...state, sessions: [...state.sessions, session].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) },
    "session.created",
    `${title} creada a las ${startsAt} con ${capacity} lugares.`
  );

  return { ok: true, state: nextState, message: `Clase creada: ${startsAt} - ${title}.` };
}

export function reserveSpot(
  state: StudioState,
  input: { sessionId: string; customerId: string; channelCode: ChannelCode }
): OperationResult {
  const session = state.sessions.find((item) => item.id === input.sessionId);
  const customer = state.customers.find((item) => item.id === input.customerId);
  const quota = session?.quotas.find((item) => item.code === input.channelCode);

  if (!session || !customer || !quota) {
    return { ok: false, state, message: "Reserva invalida. Falta clase, cliente o canal." };
  }

  const activeReservation = state.reservations.some(
    (reservation) =>
      reservation.sessionId === session.id &&
      reservation.customerId === customer.id &&
      reservation.status !== "cancelled"
  );

  if (activeReservation) {
    return { ok: false, state, message: `${customer.fullName} ya tiene una reserva activa en esa clase.` };
  }

  if (customer.status === "blocked") {
    return { ok: false, state, message: "Cliente bloqueado. No se puede reservar." };
  }

  if (quota.closed) {
    return { ok: false, state, message: `${quota.name} esta cerrado para esta clase.` };
  }

  if (reservedTotal(session) >= session.capacity) {
    return { ok: false, state, message: "Clase llena. La reserva se bloqueo para evitar sobrecupo." };
  }

  if (quota.reserved >= quota.quota) {
    return {
      ok: false,
      state,
      message: `${quota.name} lleno. No se puede tomar cupo de otro canal sin decision del manager.`
    };
  }

  const reservation: ReservationRecord = {
    id: `res_${Date.now()}`,
    sessionId: session.id,
    customerId: customer.id,
    channelCode: quota.code,
    status: "confirmed"
  };

  const nextState = addAuditEvent(
    {
      ...state,
      sessions: updateQuota(state.sessions, session.id, quota.code, (item) => ({ ...item, reserved: item.reserved + 1 })),
      reservations: [...state.reservations, reservation]
    },
    "reservation.created",
    `${customer.fullName} reservado en ${session.startsAt} por ${quota.name}.`
  );

  return { ok: true, state: nextState, message: `Reserva confirmada: ${customer.fullName} en ${session.startsAt} por ${quota.name}.` };
}

export function cancelChannelReservation(state: StudioState, sessionId: string, channelCode: ChannelCode): OperationResult {
  const session = state.sessions.find((item) => item.id === sessionId);
  const quota = session?.quotas.find((item) => item.code === channelCode);

  if (!session || !quota || quota.reserved <= 0) {
    return { ok: false, state, message: "No hay reservas para cancelar en ese canal." };
  }

  const nextReserved = Math.max(0, quota.reserved - 1);
  const nextState = addAuditEvent(
    {
      ...state,
      sessions: updateQuota(state.sessions, sessionId, channelCode, (item) => ({
        ...item,
        reserved: nextReserved,
        checkedIn: Math.min(item.checkedIn, nextReserved)
      }))
    },
    "reservation.cancelled",
    `${quota.name} libero 1 lugar en la clase de ${session.startsAt}.`
  );

  return { ok: true, state: nextState, message: `Cancelacion registrada. ${quota.name} libero 1 lugar en la clase de ${session.startsAt}.` };
}

export function checkInChannelReservation(state: StudioState, sessionId: string, channelCode: ChannelCode): OperationResult {
  const session = state.sessions.find((item) => item.id === sessionId);
  const quota = session?.quotas.find((item) => item.code === channelCode);

  if (!session || !quota || quota.checkedIn >= quota.reserved) {
    return { ok: false, state, message: "No hay reservas pendientes de check-in en ese canal." };
  }

  const nextState = addAuditEvent(
    {
      ...state,
      sessions: updateQuota(state.sessions, sessionId, channelCode, (item) => ({ ...item, checkedIn: item.checkedIn + 1 }))
    },
    "attendance.checked_in",
    `Check-in registrado para ${quota.name} en la clase de ${session.startsAt}.`
  );

  return { ok: true, state: nextState, message: `Check-in registrado para ${quota.name} en la clase de ${session.startsAt}.` };
}

export function toggleChannel(state: StudioState, sessionId: string, channelCode: ChannelCode): OperationResult {
  const session = state.sessions.find((item) => item.id === sessionId);
  const quota = session?.quotas.find((item) => item.code === channelCode);

  if (!session || !quota) {
    return { ok: false, state, message: "Canal no encontrado." };
  }

  const closing = !quota.closed;
  const nextState = addAuditEvent(
    {
      ...state,
      sessions: updateQuota(state.sessions, sessionId, channelCode, (item) => ({ ...item, closed: closing }))
    },
    closing ? "channel.closed" : "channel.opened",
    `${quota.name} ${closing ? "cerrado" : "abierto"} para ${session.startsAt}.`
  );

  return { ok: true, state: nextState, message: `${quota.name} ${closing ? "cerrado" : "abierto"} para la clase de ${session.startsAt}.` };
}

export function adjustChannelQuota(state: StudioState, sessionId: string, channelCode: ChannelCode, delta: number): OperationResult {
  const session = state.sessions.find((item) => item.id === sessionId);
  const quota = session?.quotas.find((item) => item.code === channelCode);

  if (!session || !quota) {
    return { ok: false, state, message: "Canal no encontrado." };
  }

  const nextQuota = quota.quota + delta;
  const nextQuotaSum = session.quotas.reduce((sum, item) => sum + (item.code === channelCode ? nextQuota : item.quota), 0);

  if (nextQuota < quota.reserved) {
    return { ok: false, state, message: "No puedes bajar el cupo por debajo de reservas existentes." };
  }

  if (nextQuota < 0) {
    return { ok: false, state, message: "El cupo no puede ser negativo." };
  }

  if (nextQuotaSum > session.capacity) {
    return { ok: false, state, message: "La suma de cupos por canal no puede superar el cupo total." };
  }

  const nextState = addAuditEvent(
    {
      ...state,
      sessions: updateQuota(state.sessions, sessionId, channelCode, (item) => ({ ...item, quota: nextQuota }))
    },
    "channel.quota_adjusted",
    `${quota.name} cambio de ${quota.quota} a ${nextQuota} lugares en ${session.startsAt}.`
  );

  return { ok: true, state: nextState, message: `Cupo actualizado: ${quota.name} ahora tiene ${nextQuota} lugares.` };
}

export function addToWaitlist(state: StudioState, sessionId: string): OperationResult {
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) {
    return { ok: false, state, message: "Clase no encontrada." };
  }

  const nextState = addAuditEvent(
    {
      ...state,
      sessions: state.sessions.map((item) => (item.id === sessionId ? { ...item, waitlist: item.waitlist + 1 } : item))
    },
    "waitlist.added",
    `Cliente agregado a waitlist en ${session.startsAt}.`
  );

  return { ok: true, state: nextState, message: `Cliente agregado a waitlist en ${session.startsAt}.` };
}

export function convertWaitlist(state: StudioState, sessionId: string): OperationResult {
  const session = state.sessions.find((item) => item.id === sessionId);
  const directQuota = session?.quotas.find((quota) => quota.code === "direct");

  if (!session || !directQuota) {
    return { ok: false, state, message: "Clase o canal directo no encontrado." };
  }

  if (session.waitlist <= 0) {
    return { ok: false, state, message: "No hay clientes en waitlist para convertir." };
  }

  if (reservedTotal(session) >= session.capacity || directQuota.reserved >= directQuota.quota || directQuota.closed) {
    return { ok: false, state, message: "No hay cupo directo disponible para convertir waitlist." };
  }

  const nextState = addAuditEvent(
    {
      ...state,
      sessions: state.sessions.map((item) =>
        item.id === sessionId
          ? {
              ...item,
              waitlist: Math.max(0, item.waitlist - 1),
              quotas: item.quotas.map((quota) =>
                quota.code === "direct" ? { ...quota, reserved: quota.reserved + 1 } : quota
              )
            }
          : item
      )
    },
    "waitlist.converted",
    `Waitlist convertida en reserva directa para ${session.startsAt}.`
  );

  return { ok: true, state: nextState, message: `Waitlist convertida en reserva directa para ${session.startsAt}.` };
}

function updateQuota(
  sessions: ClassSession[],
  sessionId: string,
  channelCode: ChannelCode,
  updater: (quota: ClassSession["quotas"][number]) => ClassSession["quotas"][number]
) {
  return sessions.map((session) =>
    session.id === sessionId
      ? {
          ...session,
          quotas: session.quotas.map((quota) => (quota.code === channelCode ? updater(quota) : quota))
        }
      : session
  );
}

function channelName(code: ChannelCode) {
  const names: Record<ChannelCode, string> = {
    direct: "Directo",
    whatsapp: "WhatsApp",
    fitpass: "Fitpass",
    totalpass: "TotalPass",
    wellhub: "Wellhub"
  };

  return names[code];
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}
