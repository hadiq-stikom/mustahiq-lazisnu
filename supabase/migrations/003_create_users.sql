-- Migration: Membuat user awal untuk komunitas
-- Jalankan di Supabase SQL Editor

select auth.admin.create_user(
  jsonb_build_object(
    'email', 'admin@badean.local',
    'password', 'admin123',
    'email_confirm', true,
    'user_metadata', jsonb_build_object('role', 'admin')
  )
);

select auth.admin.create_user(
  jsonb_build_object(
    'email', 'bendahara@badean.local',
    'password', 'bendahara123',
    'email_confirm', true,
    'user_metadata', jsonb_build_object('role', 'bendahara')
  )
);

select auth.admin.create_user(
  jsonb_build_object(
    'email', 'petugas@badean.local',
    'password', 'petugas123',
    'email_confirm', true,
    'user_metadata', jsonb_build_object('role', 'petugas')
  )
);
