import { Shield, Users, User } from 'lucide-react';

interface WelcomePageProps {
  onSelectPlayer: () => void;
  onSelectTrainer: () => void;
}

export default function WelcomePage({ onSelectPlayer, onSelectTrainer }: WelcomePageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 bg-black rounded-4xl rotate-6 opacity-10" />
            <div className="absolute inset-0 bg-black rounded-4xl flex items-center justify-center shadow-elevated ring-4 ring-black/5">
              <Shield className="w-10 h-10 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-4xl text-display text-black mb-2">Triva</h1>
          <p className="text-gray-500 text-sm leading-relaxed font-medium">
            Välj hur du vill fortsätta
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onSelectPlayer}
            className="w-full bg-white rounded-3xl border border-gray-200 p-5 flex items-center gap-4 hover:border-black hover:shadow-elevated hover:-translate-y-0.5 transition-all text-left group"
          >
            <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <User className="w-7 h-7" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <p className="font-extrabold text-black text-lg text-heading">Jag är spelare</p>
              <p className="text-sm text-gray-500 font-medium">Logga in med ditt namn och din lagkod</p>
            </div>
          </button>

          <button
            onClick={onSelectTrainer}
            className="w-full bg-white rounded-3xl border border-gray-200 p-5 flex items-center gap-4 hover:border-black hover:shadow-elevated hover:-translate-y-0.5 transition-all text-left group"
          >
            <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-7 h-7" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <p className="font-extrabold text-black text-lg text-heading">Jag är tränare</p>
              <p className="text-sm text-gray-500 font-medium">Logga in med din tränarkod</p>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
}
