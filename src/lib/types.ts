export type ChannelCode = "direct" | "whatsapp" | "fitpass" | "totalpass" | "wellhub";

export type ChannelQuota = {
  code: ChannelCode;
  name: string;
  quota: number;
  reserved: number;
  checkedIn: number;
  closed?: boolean;
};

export type ClassSession = {
  id: string;
  title: string;
  startsAt: string;
  coach: string;
  room: string;
  capacity: number;
  waitlist: number;
  quotas: ChannelQuota[];
};

export type StudioState = {
  sessions: ClassSession[];
  customers: Customer[];
  reservations: ReservationRecord[];
  auditLog: AuditEvent[];
};

export type DailyAction = {
  id: string;
  label: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

export type Customer = {
  id: string;
  fullName: string;
  phone: string;
  status: "active" | "inactive" | "blocked";
};

export type ReservationRecord = {
  id: string;
  sessionId: string;
  customerId: string;
  channelCode: ChannelCode;
  status: "confirmed" | "cancelled" | "checked_in" | "no_show";
};

export type AuditEvent = {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
};
