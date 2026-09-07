import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { store } from '@/services/store';

type PublisherState = { authUserId: string | null; allowed: boolean; loading: boolean };

/** The server, not a display name or Login As identity, grants upload authority. */
export const useTargetRealizationPublisher = () => {
  const { session, profile } = useAuth();
  const [state, setState] = useState<PublisherState>({ authUserId: null, allowed: false, loading: false });
  const [actingUserId, setActingUserId] = useState(() => store.getCurrentUser().id);
  const authUserId = session?.user.id || null;
  const candidate = Boolean(
    authUserId && profile?.active && profile.auth_user_id === authUserId &&
    profile.legacy_user_id?.trim().toUpperCase() === 'USR-000024'
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setActingUserId(store.getCurrentUser().id));
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    if (!candidate || !authUserId) {
      setState({ authUserId, allowed: false, loading: false });
      return () => { active = false; };
    }
    setState({ authUserId, allowed: false, loading: true });
    void supabase.rpc('can_publish_marketing_targets').then(({ data, error }) => {
      if (active) setState({ authUserId, allowed: !error && data === true, loading: false });
    }, () => {
      if (active) setState({ authUserId, allowed: false, loading: false });
    });
    return () => { active = false; };
  }, [authUserId, candidate]);

  // A newly mounted publisher page must not redirect before its first check.
  const loading = Boolean(candidate && (state.authUserId !== authUserId || state.loading));
  const identityMatches = candidate && actingUserId === 'USR-000024' && state.authUserId === authUserId;
  return {
    canPublish: Boolean(identityMatches && state.allowed && !loading),
    loading,
  };
};
