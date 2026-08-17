export type ChecklistCategory = 'weather' | 'routine' | 'documents' | 'other';

export type InventoryCategory =
  | 'electronics'
  | 'documents'
  | 'weather-gear'
  | 'other';

export type GeofenceTriggerType = 'enter' | 'exit';

export type TripType =
  | 'commute'
  | 'day-trip'
  | 'overnight'
  | 'business'
  | 'flight'
  | 'other';

export type WeatherCondition =
  | 'rain'
  | 'snow'
  | 'extreme-heat'
  | 'extreme-cold'
  | 'wind'
  | 'clear';

export interface Trip {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  tripType: TripType | null;
  templateApplied: boolean;
  createdAt: string;
}

export interface TemplateApplied {
  checklistAdded: number;
  inventoryAdded: number;
  zonesAdded: number;
  weatherCondition: WeatherCondition | null;
}

export interface ChecklistItem {
  id: number;
  label: string;
  category: ChecklistCategory;
  isChecked: boolean;
  isWeatherTriggered: boolean;
  weatherCondition: WeatherCondition | null;
  sortOrder: number;
  createdAt: string;
  inventoryItemId: number | null;
  tripId: number | null;
}

export interface ChecklistItemUpdate {
  label?: string;
  category?: ChecklistCategory;
  isChecked?: boolean;
  isWeatherTriggered?: boolean;
  weatherCondition?: WeatherCondition | null;
  sortOrder?: number;
  inventoryItemId?: number | null;
  tripId?: number | null;
}

export interface Weather {
  temperatureCelsius: number;
  windSpeedKmh: number;
  condition: WeatherCondition;
  /** Today's forecast high; absent if the provider omitted the daily block. */
  highCelsius: number | null;
  lowCelsius: number | null;
  fetchedAt: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  category: InventoryCategory;
  quantity: number;
  isPacked: boolean;
  tripId: number | null;
}

export interface GeofenceTrigger {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  triggerType: GeofenceTriggerType;
  notificationMessage: string;
  isActive: boolean;
  tripId: number | null;
}

export interface SavedDestination {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
  tripId: number | null;
}

export interface Distance {
  distanceKm: number;
  bearingDegrees: number;
}

export interface GeofenceEvent {
  id: number;
  triggerId: number;
  direction: GeofenceTriggerType;
  firedAt: string;
}
