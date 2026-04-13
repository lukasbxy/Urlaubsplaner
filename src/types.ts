export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface Trip {
  id: string;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  ownerId: string;
  collaboratorIds: string[];
  createdAt: string;
  flightCost?: number;
  trainCost?: number;
  transportCost?: number;
}

export type TripItemType = 'location' | 'flight' | 'accommodation' | 'activity' | 'transport' | 'train';

export interface TripItem {
  id: string;
  tripId: string;
  type: TripItemType;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  locationName?: string;
  lat?: number;
  lng?: number;
  endLocationName?: string;
  endLat?: number;
  endLng?: number;
  cost?: number;
  bookingReference?: string;
  fileData?: string;
  fileName?: string;
  order: number;
  createdAt: string;
}
