/**
 * Authentication Architecture & User Session Types for SIEG.AI
 */

import { ApplicantDetails, DocumentItem, ProfileSection, QualificationRequirement, DashboardStats } from '../types';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface UserApplicationData {
  details: ApplicantDetails;
  documents: DocumentItem[];
  profileSections: ProfileSection[];
  requirements: QualificationRequirement[];
  dashboardStats: DashboardStats;
  isCertificateUploaded: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}
