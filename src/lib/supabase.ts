import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://REDACTED_PROJECT_REF.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'REMOVED_JWT';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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