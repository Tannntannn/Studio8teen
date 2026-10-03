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
    let cancelled = false;
    let settleId = 0;

    const settle = async (session, event) => {
      const id = ++settleId;
      const stillCurrent = () => !cancelled && id === settleId;
      setLoading(true);

      if (session?.user && !isEmailConfirmed(session.user)) {
        await supabase.auth.signOut();
        if (!stillCurrent()) return;
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        await fetchProfile(nextUser.id);
        if (stillCurrent() && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED")) {
          void initOneSignal(nextUser.id);
        }
      } else if (stillCurrent()) {
        setProfile(null);
        if (event === "SIGNED_OUT") void logoutOneSignal();
      }
      if (stillCurrent()) setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void settle(session, "INITIAL_SESSION");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      if (event === "TOKEN_REFRESHED") {
        setUser(session?.user ?? null);
        return;
      }
      setTimeout(() => {
        void settle(session, event);
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
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

  // Guest only after the profile row is loaded, so a refresh does not treat the user as a guest first.
  const isGuest = Boolean(
    profile &&
      !profile.claimed_at &&
      !profile.guest_archived_at &&
      (profile.is_guest ||
        user?.user_metadata?.is_guest ||
        isGuestEmail(user?.email) ||
        isGuestEmail(profile.email))
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
