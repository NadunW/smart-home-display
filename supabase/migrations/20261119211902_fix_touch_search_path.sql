-- Pin the search path of the updated_at trigger function (Supabase advisor 0011).
alter function public.touch_updated_at() set search_path = '';
