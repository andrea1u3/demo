import type { AuditEvent, ClassSession, Customer, DailyAction, ReservationRecord, StudioState } from "./types";

export const sessions: ClassSession[] = [
  {
    id: "cls_0900",
    title: "Reformer Flow",
    startsAt: "09:00",
    coach: "Mariana",
    room: "Sala A",
    capacity: 10,
    waitlist: 2,
    quotas: [
      { code: "direct", name: "Directo", quota: 5, reserved: 5, checkedIn: 4 },
      { code: "whatsapp", name: "WhatsApp", quota: 2, reserved: 2, checkedIn: 2 },
      { code: "fitpass", name: "Fitpass", quota: 2, reserved: 2, checkedIn: 1 },
      { code: "totalpass", name: "TotalPass", quota: 1, reserved: 0, checkedIn: 0 }
    ]
  },
  {
    id: "cls_1200",
    title: "Power Reformer",
    startsAt: "12:00",
    coach: "Sofia",
    room: "Sala A",
    capacity: 10,
    waitlist: 0,
    quotas: [
      { code: "direct", name: "Directo", quota: 6, reserved: 3, checkedIn: 0 },
      { code: "whatsapp", name: "WhatsApp", quota: 2, reserved: 1, checkedIn: 0 },
      { code: "fitpass", name: "Fitpass", quota: 1, reserved: 1, checkedIn: 0 },
      { code: "wellhub", name: "Wellhub", quota: 1, reserved: 0, checkedIn: 0 }
    ]
  },
  {
    id: "cls_1900",
    title: "Reformer Control",
    startsAt: "19:00",
    coach: "Diego",
    room: "Sala A",
    capacity: 10,
    waitlist: 5,
    quotas: [
      { code: "direct", name: "Directo", quota: 7, reserved: 7, checkedIn: 0 },
      { code: "whatsapp", name: "WhatsApp", quota: 2, reserved: 2, checkedIn: 0 },
      { code: "fitpass", name: "Fitpass", quota: 1, reserved: 1, checkedIn: 0 }
    ]
  }
];

export const actions: DailyAction[] = [
  {
    id: "low_occupancy",
    label: "Llenar clase de 12:00",
    detail: "Ocupacion reservada 50%. Hay 5 lugares libres para ofrecer por WhatsApp.",
    priority: "high"
  },
  {
    id: "fitpass_full",
    label: "Fitpass lleno a las 09:00",
    detail: "Canal externo lleno con 1 no-show historico. No muevas cupos directos sin decision del manager.",
    priority: "medium"
  },
  {
    id: "waitlist_peak",
    label: "Waitlist alta a las 19:00",
    detail: "5 personas esperando. Considera abrir otro horario o mover cupo externo a directo.",
    priority: "medium"
  },
  {
    id: "inactive_clients",
    label: "Recuperar 8 clientes inactivos",
    detail: "Sin asistencia en 30 dias y con historial de compra directa.",
    priority: "low"
  }
];

export const customers: Customer[] = [
  { id: "cus_ana", fullName: "Ana Lopez", phone: "+52 55 0000 0001", status: "active" },
  { id: "cus_carla", fullName: "Carla Ruiz", phone: "+52 55 0000 0002", status: "active" },
  { id: "cus_diana", fullName: "Diana Perez", phone: "+52 55 0000 0003", status: "active" },
  { id: "cus_fer", fullName: "Fernanda Soto", phone: "+52 55 0000 0004", status: "active" },
  { id: "cus_lucia", fullName: "Lucia Mora", phone: "+52 55 0000 0005", status: "inactive" },
  { id: "cus_mateo", fullName: "Mateo Cano", phone: "+52 55 0000 0006", status: "active" },
  { id: "cus_vale", fullName: "Valeria Rios", phone: "+52 55 0000 0007", status: "active" }
];

export const reservations: ReservationRecord[] = [
  { id: "res_1", sessionId: "cls_0900", customerId: "cus_ana", channelCode: "direct", status: "checked_in" },
  { id: "res_2", sessionId: "cls_0900", customerId: "cus_carla", channelCode: "fitpass", status: "confirmed" },
  { id: "res_3", sessionId: "cls_1200", customerId: "cus_diana", channelCode: "whatsapp", status: "confirmed" },
  { id: "res_4", sessionId: "cls_1900", customerId: "cus_fer", channelCode: "direct", status: "confirmed" }
];

export const auditLog: AuditEvent[] = [
  {
    id: "audit_seed",
    action: "demo.loaded",
    detail: "Datos iniciales cargados para operar el MVP.",
    createdAt: new Date("2026-05-20T09:00:00-06:00").toISOString()
  }
];

export const initialStudioState: StudioState = {
  sessions,
  customers,
  reservations,
  auditLog
};
