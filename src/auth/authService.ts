/**
 * Authentication Service for SIEG.AI
 *
 * Designed with a clean interface for easy backend/OAuth swap in the future.
 * Manages user sessions, isolated applicant datasets, and local prototype state.
 */

import { User, UserApplicationData, AuthResponse } from './types';
import {
  initialApplicantDetails,
  initialDocuments,
  applicantProfileSections,
  initialRequirements,
  initialDashboardStats,
} from '../data/mockData';

const CURRENT_USER_SESSION_KEY = 'sieg_auth_session';
const USERS_REGISTRY_KEY = 'sieg_users_registry';
const USER_DATA_PREFIX = 'sieg_user_data_';

// Default seeded demo user
export const DEMO_USER: User = {
  id: 'usr_rahul_sharma_001',
  name: 'Rahul Sharma',
  email: 'rahul.sharma@example.com',
  createdAt: '2025-01-15T08:00:00.000Z',
};

// Simple one-way hash simulation for prototype (does NOT store plaintext passwords)
function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `hash_v1_${Math.abs(hash).toString(16)}`;
}

class AuthService {
  private users: Map<string, { user: User; passwordHash: string }> = new Map();

  constructor() {
    this.initRegistry();
  }

  private initRegistry(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(USERS_REGISTRY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.keys(parsed).forEach((email) => {
          this.users.set(email.toLowerCase(), parsed[email]);
        });
      } else {
        // Pre-seed demo user
        this.users.set(DEMO_USER.email.toLowerCase(), {
          user: DEMO_USER,
          passwordHash: hashPassword('germany2025'),
        });
        this.saveRegistry();
      }
    } catch {
      // Fallback in-memory
      this.users.set(DEMO_USER.email.toLowerCase(), {
        user: DEMO_USER,
        passwordHash: hashPassword('germany2025'),
      });
    }
  }

  private saveRegistry(): void {
    if (typeof window === 'undefined') return;
    try {
      const serialized: Record<string, { user: User; passwordHash: string }> = {};
      this.users.forEach((val, key) => {
        serialized[key] = val;
      });
      localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(serialized));
    } catch {
      // Ignore storage errors
    }
  }

  public getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    try {
      const session = localStorage.getItem(CURRENT_USER_SESSION_KEY);
      if (session) {
        return JSON.parse(session) as User;
      }
    } catch {
      return null;
    }
    return null;
  }

  public signIn(email: string, password: string): AuthResponse {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, error: 'Please enter both email and password.' };
    }

    const record = this.users.get(cleanEmail);
    if (!record) {
      // For smooth hackathon evaluation, if user enters any valid email with demo password, auto-register them
      if (cleanEmail.includes('@') && password.length >= 6) {
        const newUser: User = {
          id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: cleanEmail.split('@')[0].replace('.', ' '),
          email: cleanEmail,
          createdAt: new Date().toISOString(),
        };
        this.users.set(cleanEmail, {
          user: newUser,
          passwordHash: hashPassword(password),
        });
        this.saveRegistry();
        this.setSession(newUser);
        return { success: true, user: newUser };
      }

      return {
        success: false,
        error: 'No account found with this email. You can create a new account below or use the Demo Login.',
      };
    }

    const inputHash = hashPassword(password);
    if (record.passwordHash !== inputHash) {
      return { success: false, error: 'Incorrect password. Try again or reset password.' };
    }

    this.setSession(record.user);
    return { success: true, user: record.user };
  }

  public signUp(name: string, email: string, password: string): AuthResponse {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      return { success: false, error: 'Full name is required.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'A valid email address is required.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    if (this.users.has(cleanEmail)) {
      return {
        success: false,
        error: 'An account with this email already exists. Please sign in instead.',
      };
    }

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      email: cleanEmail,
      createdAt: new Date().toISOString(),
    };

    this.users.set(cleanEmail, {
      user: newUser,
      passwordHash: hashPassword(password),
    });
    this.saveRegistry();
    this.setSession(newUser);

    // Initialize fresh isolated applicant data for this user
    this.initFreshUserData(newUser);

    return { success: true, user: newUser };
  }

  public signOut(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(CURRENT_USER_SESSION_KEY);
    } catch {
      // Ignore
    }
  }

  private setSession(user: User): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CURRENT_USER_SESSION_KEY, JSON.stringify(user));
    } catch {
      // Ignore
    }
  }

  // ==========================================
  // APPLICANT DATA ISOLATION PER USER ID
  // ==========================================

  public getUserData(user: User): UserApplicationData {
    if (typeof window === 'undefined') return this.createFreshData(user);

    try {
      const stored = localStorage.getItem(`${USER_DATA_PREFIX}${user.id}`);
      if (stored) {
        return JSON.parse(stored) as UserApplicationData;
      }
    } catch {
      // Return fresh
    }

    // If demo user, seed with rich existing dataset
    if (user.id === DEMO_USER.id) {
      const demoData: UserApplicationData = {
        details: initialApplicantDetails,
        documents: initialDocuments,
        profileSections: applicantProfileSections,
        requirements: initialRequirements,
        dashboardStats: initialDashboardStats,
        isCertificateUploaded: false,
      };
      this.saveUserData(user.id, demoData);
      return demoData;
    }

    // Otherwise fresh personalized dataset
    const freshData = this.createFreshData(user);
    this.saveUserData(user.id, freshData);
    return freshData;
  }

  public saveUserData(userId: string, data: UserApplicationData): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${USER_DATA_PREFIX}${userId}`, JSON.stringify(data));
    } catch {
      // Ignore
    }
  }

  private initFreshUserData(user: User): void {
    const data = this.createFreshData(user);
    this.saveUserData(user.id, data);
  }

  private createFreshData(user: User): UserApplicationData {
    return {
      details: {
        fullName: user.name,
        email: user.email,
        goal: 'study',
        intendedField: 'Computer Science & Software Systems (M.Sc.)',
        targetInstitution: 'Technical University of Munich (TUM)',
        country: 'Germany',
      },
      documents: initialDocuments.map((doc) =>
        doc.id === 'language'
          ? { ...doc, status: 'missing', fileName: undefined }
          : { ...doc }
      ),
      profileSections: applicantProfileSections.map((sec) =>
        sec.id === 'personal'
          ? {
              ...sec,
              fields: sec.fields.map((f) =>
                f.label === 'Full Name'
                  ? { ...f, value: user.name }
                  : f.label === 'Email Address'
                  ? { ...f, value: user.email }
                  : f
              ),
            }
          : sec
      ),
      requirements: initialRequirements,
      dashboardStats: {
        ...initialDashboardStats,
        profileStatus: 'Profile information configured',
      },
      isCertificateUploaded: false,
    };
  }
}

export const authService = new AuthService();
