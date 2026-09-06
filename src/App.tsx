import { useEffect, useState } from 'react';
import { Loader2, Shield, Lock, LogOut } from 'lucide-react';
import { supabase, type Team } from '@/lib/supabase';
import WelcomePage from '@/components/WelcomePage';
import TrainerAuth from '@/components/TrainerAuth';
import AdminDashboard from '@/components/AdminDashboard';
import PlayerPortal from '@/components/PlayerPortal';
import SuperAdmin from '@/components/SuperAdmin';
import BookmarkPrompt from '@/components/BookmarkPrompt';

type Route = 'welcome' | 'player' | 'trainer-auth' | 'trainer-dashboard' | 'admin';

interface AdminSession {
  email: string;
  isAdmin: boolean;
}

function getRouteFromHash(): Route {
  const hash = window.location.hash;
  if (hash === '#/player') return 'player';
  if (hash === '#/trainer') return 'trainer-auth';
  if (hash === '#/dashboard') return 'trainer-dashboard';
  if (hash === '#/admin') return 'admin';
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
