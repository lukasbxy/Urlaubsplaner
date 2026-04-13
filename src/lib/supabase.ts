import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY müssen gesetzt sein (z. B. in .env oder in GitHub Actions Secrets).',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
  },
});

export interface Trip {
  id: string;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  owner_id: string;
  collaborator_ids: string[];
  created_at: string;
  flight_cost?: number;
  train_cost?: number;
  transport_cost?: number;
  items?: { start_time?: string; end_time?: string; is_all_day?: boolean }[];
}

export interface TripItem {
  id: string;
  trip_id: string;
  type: 'location' | 'flight' | 'accommodation' | 'activity' | 'transport' | 'train';
  title: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  is_all_day?: boolean;
  location_name?: string;
  lat?: number;
  lng?: number;
  end_location_name?: string;
  end_lat?: number;
  end_lng?: number;
  cost?: number;
  booking_reference?: string;
  file_data?: string;
  file_name?: string;
  item_order: number;
  created_at: string;
}

export interface Todo {
  id: string;
  trip_id: string;
  text: string;
  completed: boolean;
  todo_order: number;
  created_at: string;
}
