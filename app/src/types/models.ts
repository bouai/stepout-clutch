export type ChecklistCategory = 'weather' | 'routine' | 'documents' | 'other';

export type InventoryCategory =
  | 'electronics'
  | 'documents'
  | 'weather-gear'
  | 'other';

export type GeofenceTriggerType = 'enter' | 'exit';

export type WeatherCondition =
  | 'rain'
  | 'snow'
  | 'extreme-heat'
  | 'extreme-cold'
  | 'wind'
  | 'clear';

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
}

export interface Weather {
  temperatureCelsius: number;
  windSpeedKmh: number;
  condition: WeatherCondition;
  fetchedAt: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  category: InventoryCategory;
  quantity: number;
  isPacked: boolean;
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
}
