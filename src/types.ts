export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface Trip {
  id: string;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  owner_id: string;
  collaborator_ids: string[];
  created_at: string;
  deleted_at?: string | null;
  flight_cost?: number;
  train_cost?: number;
  transport_cost?: number;
  items?: { start_time?: string; end_time?: string; is_all_day?: boolean }[];
}

export type TripItemType = 'location' | 'flight' | 'accommodation' | 'activity' | 'transport' | 'train';

export interface TripItem {
  id: string;
  trip_id: string;
  type: TripItemType;
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