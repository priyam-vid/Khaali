import { Period, Room, Occupancy } from './rooms';

export interface KhaaliInitialData {
  periods: Period[];
  rooms: Room[];
  occupancies: Occupancy[];
  validityWindow?: {
    startDate: string;
    endDate: string;
  };
  fetchedAt: number;
  fromFallback: boolean;
}
