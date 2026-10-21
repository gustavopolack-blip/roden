-- Biblioteca de materiales del constructor 3D (rødën OS)
-- Cada material se aplica solo a las piezas cuya placa tiene el mismo nombre de color que se
-- cargó en el estimador (ej. "Roble Kendal", "Laca Blanca Brillante"). Solo dibujo: no interviene
-- en costos. Lectura: usuarios logueados. Escritura: administrador (misma regla que price_lists).
-- Aplicada en producción el 21/10/2026.

create table if not exists public.material_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,                         -- nombre del color, igual que en el estimador
  brand text,                                 -- Faplac, Egger, ...
  line text,                                  -- línea del catálogo (Nature, Blend, ...)
  kind text not null default 'MELAMINA' check (kind in ('MELAMINA', 'LACA', 'ENCHAPADO')),
  color text not null default '#c8b8a0',      -- color base (laca, o si no hay textura)
  texture_path text,                          -- ruta en el bucket material-textures
  texture_width_mm numeric not null default 1000 check (texture_width_mm > 0),   -- medida real que cubre la imagen
  texture_height_mm numeric not null default 1000 check (texture_height_mm > 0),
  grain_vertical boolean not null default true,   -- en la imagen, la veta corre de arriba abajo
  gloss numeric not null default 0.1 check (gloss >= 0 and gloss <= 1),  -- 0 mate, 1 brillante
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists material_library_name_key on public.material_library (lower(name));

alter table public.material_library enable row level security;
create policy material_library_read_auth on public.material_library
  for select to authenticated using (true);
create policy material_library_write_roles on public.material_library
  for all to authenticated
  using (roden_role() = any (string_to_array('administrador', ',')))
  with check (roden_role() = any (string_to_array('administrador', ',')));

-- Imágenes de textura: lectura pública (las usa el visor y las maquetas exportadas), escritura administrador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('material-textures', 'material-textures', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy material_textures_public_read on storage.objects
  for select to public using (bucket_id = 'material-textures');
create policy material_textures_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'material-textures' and roden_role() = 'administrador');
create policy material_textures_admin_update on storage.objects
  for update to authenticated using (bucket_id = 'material-textures' and roden_role() = 'administrador');
create policy material_textures_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'material-textures' and roden_role() = 'administrador');
