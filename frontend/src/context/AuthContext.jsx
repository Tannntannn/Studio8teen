import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { initOneSignal, logoutOneSignal } from "../lib/onesignal";

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (data?.deactivated_at) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      return null;
    }
    setProfile(data);
    return data;
  };

  const isEmailConfirmed = (authUser) =>
    Boolean(authUser?.email_confirmed_at || authUser?.confirmed_at);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user && !isEmailConfirmed(session.user)) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        void initOneSignal(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && !isEmailConfirmed(session.user)) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        return;
      }
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
          void initOneSignal(session.user.id);
        }
      } else {
        setProfile(null);
        if (event === "SIGNED_OUT") void logoutOneSignal();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: "client" },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw error;
    void supabase.auth.signOut();
    return data;
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (/banned/i.test(error.message || "")) {
        throw new Error("This account has been deactivated. Contact the studio if you think this is a mistake.");
      }
      throw error;
    }
    if (data.user && !isEmailConfirmed(data.user)) {
      await supabase.auth.signOut();
      throw new Error("Please confirm your email before logging in.");
    }
    if (data.user) {
      const prof = await fetchProfile(data.user.id);
      if (!prof) {
        throw new Error("This account has been deactivated. Contact the studio if you think this is a mistake.");
      }
      void initOneSignal(data.user.id);
    }
    return data;
  };

  const signOut = async () => {
    void logoutOneSignal();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    const {
      data: { user: current },
    } = await supabase.auth.getUser();
    if (!current) {
      setUser(null);
      setProfile(null);
      return null;
    }
    setUser(current);
    return fetchProfile(current.id);
  };

  const isGuestEmail = (email) => /@guest\.studio8teen\.local$/i.test(String(email || ""));

  // Guest if profile flag, auth metadata, or synthetic walk-in email — unless claimed/archived
  const isGuest = Boolean(
    user &&
      !profile?.claimed_at &&
      !profile?.guest_archived_at &&
      (profile?.is_guest ||
        user?.user_metadata?.is_guest ||
        isGuestEmail(user?.email) ||
        isGuestEmail(profile?.email))
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin: profile?.role === "admin",
        isClient: profile?.role === "client",
        isGuest,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
