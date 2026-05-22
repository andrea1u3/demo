insert into studios (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Pilates Roma', 'pilates-roma')
on conflict (slug) do nothing;

insert into coaches (id, studio_id, name)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Mariana'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Sofia')
on conflict (studio_id, name) do nothing;

insert into rooms (id, studio_id, name, capacity)
values ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'Sala A', 10)
on conflict (studio_id, name) do nothing;

insert into channel_definitions (id, studio_id, code, name)
values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', 'direct', 'Directo'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', 'whatsapp', 'WhatsApp'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000001', 'fitpass', 'Fitpass'),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000001', 'totalpass', 'TotalPass'),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000001', 'wellhub', 'Wellhub')
on conflict (studio_id, code) do nothing;

insert into customers (id, studio_id, full_name, phone, email)
values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000001', 'Ana Lopez', '+525500000001', 'ana@example.com'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000001', 'Carla Ruiz', '+525500000002', 'carla@example.com'),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000001', 'Diana Perez', '+525500000003', null)
on conflict (studio_id, phone) do nothing;
