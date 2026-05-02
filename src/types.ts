export type UserRole = 'owner' | 'mechanic' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  vehicle?: string;
}

export interface Booking {
  id: string;
  type: string;
  date: string;
  status: 'pending' | 'completed' | 'rejected';
  userId: string;
  notes?: string;
}

export interface ServiceOffer {
  id: string;
  name: string;
  icon: string;
  available: boolean;
}
