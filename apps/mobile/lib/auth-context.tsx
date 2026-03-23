import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './api';

interface AuthState {
  user: SupabaseUser | null;
  session: Session | null;
  isLoading: boolean;
  /** Whether the user has completed onboarding (from our users table) */
  onboardingCompleted: boolean | null;
}

interface SignUpResult {
  error: string | null;
  /** True when the account was created but email confirmation is required before sign-in */
  needsEmailConfirmation: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  refreshOnboardingStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    onboardingCompleted: null,
  });

  // Check onboarding status from our users table
  const checkOnboardingStatus = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('onboarding_completed')
        .eq('id', userId)
        .single();

      if (error) {
        // Row might not exist yet (trigger delay) - treat as not completed
        return false;
      }
      return data?.onboarding_completed ?? false;
    } catch {
      return false;
    }
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      let onboardingCompleted: boolean | null = null;
      if (session?.user) {
        onboardingCompleted = await checkOnboardingStatus(session.user.id);
      }
      setState({
        user: session?.user ?? null,
        session,
        isLoading: false,
        onboardingCompleted,
      });
    });

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      let onboardingCompleted: boolean | null = null;
      if (session?.user) {
        onboardingCompleted = await checkOnboardingStatus(session.user.id);
      }
      setState({
        user: session?.user ?? null,
        session,
        isLoading: false,
        onboardingCompleted,
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkOnboardingStatus]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (error) {
        return { error: error.message, needsEmailConfirmation: false };
      }

      // Supabase returns a user but no session when email confirmation is required.
      // The user exists but can't sign in until they click the confirmation link.
      const needsEmailConfirmation = !!data.user && !data.session;
      return { error: null, needsEmailConfirmation };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      user: null,
      session: null,
      isLoading: false,
      onboardingCompleted: null,
    });
  }, []);

  const refreshOnboardingStatus = useCallback(async () => {
    if (state.user) {
      const completed = await checkOnboardingStatus(state.user.id);
      setState((prev) => ({ ...prev, onboardingCompleted: completed }));
    }
  }, [state.user, checkOnboardingStatus]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      signUp,
      signOut,
      refreshOnboardingStatus,
    }),
    [state, signIn, signUp, signOut, refreshOnboardingStatus],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
