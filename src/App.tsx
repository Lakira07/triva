import { FormEvent, useEffect, useState } from 'react';
import { Loader2, Shield, Lock } from 'lucide-react';
import { supabase, type Team } from '@/lib/supabase';
import WelcomePage from '@/components/WelcomePage';
import TrainerAuth from '@/components/TrainerAuth';
import AdminDashboard from '@/components/AdminDashboard';
import PlayerPortal from '@/components/PlayerPortal';
import SuperAdmin from '@/components/SuperAdmin';
import AdminRegister from '@/components/AdminRegister';
import BookmarkPrompt from '@/components/BookmarkPrompt';
import DemoBookingPage from '@/components/DemoBookingPage';

type Route = 'welcome' | 'demo' | 'player' | 'player-invite' | 'trainer-auth' | 'trainer-dashboard' | 'admin' | 'admin-register';

interface AdminSession {
  email: string;
  isAdmin: boolean;
}

function getRouteFromHash(): Route {
  const hash = window.location.hash;
  if (new URLSearchParams(window.location.search).get('invite') === '1') return 'player-invite';
  if (hash === '#/demo') return 'demo';
  if (hash === '#/player') return 'player';
  if (hash === '#/trainer') return 'trainer-auth';
  if (hash === '#/dashboard') return 'trainer-dashboard';
  if (hash === '#/admin') return 'admin';
  if (hash === '#/admin-register') return 'admin-register';
  return 'welcome';
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRouteFromHash());
  const [team, setTeam] = useState<Team | null>(null);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);

  useEffect(() => {
    const onHashChange = () => setRoute(getRouteFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, is_admin')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile?.is_admin) {
          setAdminSession({ email: profile.email, isAdmin: true });
          if (window.location.hash !== '#/admin') {
            window.location.hash = '#/admin';
            setRoute('admin');
          }
        } else {
          const { data: teams } = await supabase
            .from('teams')
            .select('*')
            .eq('owner_id', session.user.id)
            .maybeSingle();
          if (teams) {
            setTeam(teams as Team);
            if (window.location.hash !== '#/dashboard') {
              window.location.hash = '#/dashboard';
              setRoute('trainer-dashboard');
            }
          }
        }
      }
      setRestoringSession(false);
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setTeam(null);
        setAdminSession(null);
        if (window.location.hash === '#/admin' || window.location.hash === '#/dashboard') {
          window.location.hash = '';
        }
      } else if (event === 'SIGNED_IN' && session) {
        (async () => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, is_admin')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile?.is_admin) {
            setAdminSession({ email: profile.email, isAdmin: true });
          } else {
            const { data: teams } = await supabase
              .from('teams')
              .select('*')
              .eq('owner_id', session.user.id)
              .maybeSingle();
            if (teams) {
              setTeam(teams as Team);
            }
          }
        })();
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  if (restoringSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-black animate-spin" />
      </div>
    );
  }

  if (route === 'player-invite') {
    return (
      <PlayerInviteSetup
        onComplete={() => {
          window.location.hash = '#/player';
          setRoute('player');
        }}
      />
    );
  }

  // ADMIN ROUTE
  if (route === 'admin') {
    if (adminSession?.isAdmin) {
      return (
        <div className="min-h-screen bg-gray-50">
          <SuperAdmin
            session={adminSession}
            onLogout={async () => {
              await supabase.auth.signOut();
              setAdminSession(null);
              window.location.hash = '';
            }}
          />
          <BookmarkPrompt />
        </div>
      );
    }
    return (
      <>
        <AdminLogin onLogin={setAdminSession} />
        <BookmarkPrompt />
      </>
    );
  }

  if (route === 'admin-register') {
    return (
      <>
        <AdminRegister
          onRegistered={() => {
            window.location.hash = '#/admin';
          }}
          onBack={() => (window.location.hash = '')}
        />
        <BookmarkPrompt />
      </>
    );
  }

  if (route === 'welcome') {
    return (
      <div className="min-h-screen bg-gray-50">
        <WelcomePage
          onSelectPlayer={() => (window.location.hash = '#/player')}
          onSelectTrainer={() => (window.location.hash = '#/trainer')}
        />
        <BookmarkPrompt />
      </div>
    );
  }

  if (route === 'demo') {
    return (
      <>
        <DemoBookingPage />
        <BookmarkPrompt />
      </>
    );
  }

  if (route === 'player') {
    return (
      <div className="min-h-screen bg-gray-50">
        <PlayerPortal />
        <BookmarkPrompt />
      </div>
    );
  }

  if (route === 'trainer-auth') {
    return (
      <>
        <TrainerAuth
          onAuthed={(t) => {
            setTeam(t);
            window.location.hash = '#/dashboard';
          }}
          onBack={() => (window.location.hash = '')}
        />
        <BookmarkPrompt />
      </>
    );
  }

  if (route === 'trainer-dashboard' && team) {
    return (
      <>
        <AdminDashboard
          team={team}
          onLogout={async () => {
            await supabase.auth.signOut();
            setTeam(null);
            window.location.hash = '';
          }}
        />
        <BookmarkPrompt />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <WelcomePage
        onSelectPlayer={() => (window.location.hash = '#/player')}
        onSelectTrainer={() => (window.location.hash = '#/trainer')}
      />
      <BookmarkPrompt />
    </div>
  );
}

function PlayerInviteSetup({ onComplete }: { onComplete: () => void }) {
  const [sessionReady, setSessionReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setSessionReady(true);
    });
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && session) setSessionReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      setError('Lösenordet måste vara minst 8 tecken.');
      return;
    }
    if (password !== confirmation) {
      setError('Lösenorden matchar inte.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-black">Skapa ditt lösenord</h1>
          <p className="mt-2 text-sm text-gray-500">Välj ett personligt lösenord för ditt spelarkonto.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="invite-password" className="mb-1.5 block text-sm font-semibold text-gray-700">Lösenord</label>
            <input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={!sessionReady || saving}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label htmlFor="invite-password-confirm" className="mb-1.5 block text-sm font-semibold text-gray-700">Upprepa lösenord</label>
            <input
              id="invite-password-confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              disabled={!sessionReady || saving}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 disabled:bg-gray-50"
            />
          </div>
          {!sessionReady && <p className="text-sm text-amber-700">Inbjudningslänken är ogiltig eller har gått ut. Be tränaren skicka en ny.</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={!sessionReady || !password || !confirmation || saving}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Spara lösenord och fortsätt'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }: { onLogin: (s: AdminSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password || loading) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, is_admin')
      .eq('id', data.user.id)
      .maybeSingle();
    if (!profile?.is_admin) {
      setError('Detta konto har inte admin-behörighet.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }
    onLogin({ email: profile.email, isAdmin: true });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center mx-auto mb-4 ring-4 ring-black/5 shadow-lg">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-black tracking-tight mb-1">Admin-inloggning</h1>
          <p className="text-sm text-gray-500">Endast för systemadministratörer</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-post</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@spelarportalen.se"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Lösenord</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <button
              onClick={handleLogin}
              disabled={loading || !email.trim() || !password}
              className="w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-lg"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Shield className="w-5 h-5" /> Logga in som admin
                </>
              )}
            </button>
          </div>
        </div>

        <button
          onClick={() => (window.location.hash = '')}
          className="w-full text-center text-sm text-gray-400 hover:text-black transition-colors mt-4"
        >
          Tillbaka till startsidan
        </button>
      </div>
    </div>
  );
}
