import { useState, useEffect } from 'react';
import { X, Bookmark, Share, Apple, Smartphone, Check, HelpCircle } from 'lucide-react';

const STORAGE_KEY = 'triva-bookmark-dismissed';

export default function BookmarkPrompt() {
  const [visible, setVisible] = useState(false);
  const [showHelpButton, setShowHelpButton] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) {
      setPlatform('ios');
    } else if (/Android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('other');
    }

    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setVisible(true);
    } else {
      setShowHelpButton(true);
    }
  }, []);

  const openFromHelp = () => {
    setVisible(true);
    setShowHelpButton(false);
  };

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
    setShowHelpButton(true);
  };

  return (
    <>
      {/* Help button — top right corner */}
      {showHelpButton && (
        <button
          onClick={openFromHelp}
          className="fixed top-4 right-4 z-40 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-black hover:shadow-xl hover:scale-105 transition-all group"
          title="Hur lägger jag Triva på hemskärmen?"
          aria-label="Hjälp: lägg Triva på hemskärmen"
        >
          <HelpCircle className="w-5 h-5" />
          <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-black rounded-full ring-2 ring-white" />
        </button>
      )}

      {/* Modal */}
      {visible && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0" onClick={handleClose}>
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideUp 0.3s ease-out' }}
          >
            {/* Header */}
            <div className="relative bg-black px-6 pt-6 pb-8 text-white">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-4 ring-2 ring-white/20">
                <Bookmark className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Lägg Triva på hemskärmen</h2>
              <p className="text-sm text-white/70 mt-1 leading-relaxed">
                Kom åt Triva snabbt — precis som en app, utan att behöva öppna webbläsaren varje gång.
              </p>
            </div>

            {/* Instructions */}
            <div className="px-6 py-5">
              {platform === 'ios' && (
                <div className="space-y-4">
                  <Step number={1} icon={<Share className="w-4 h-4" />}>
                    Tryck på <span className="font-semibold">Dela-knappen</span> (<Share className="w-3.5 h-3.5 inline -mt-0.5" />) i nedre delen av skärmen.
                  </Step>
                  <Step number={2} icon={<Bookmark className="w-4 h-4" />}>
                    Välj <span className="font-semibold">"Lägg till på hemskärmen"</span> i menyn.
                  </Step>
                  <Step number={3} icon={<Check className="w-4 h-4" />}>
                    Tryck på <span className="font-semibold">"Lägg till"</span> — klart! Triva visas nu som en app på din hemskärm.
                  </Step>
                  <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                    <Apple className="w-3.5 h-3.5" /> Fungerar på iPhone och iPad
                  </div>
                </div>
              )}

              {platform === 'android' && (
                <div className="space-y-4">
                  <Step number={1} icon={<Share className="w-4 h-4" />}>
                    Tryck på <span className="font-semibold">tre punkter</span> (⋮) uppe till höger i webbläsaren.
                  </Step>
                  <Step number={2} icon={<Bookmark className="w-4 h-4" />}>
                    Välj <span className="font-semibold">"Lägg till på startsidan"</span> eller <span className="font-semibold">"Lägg till på hemskärmen"</span>.
                  </Step>
                  <Step number={3} icon={<Check className="w-4 h-4" />}>
                    Tryck på <span className="font-semibold">"Lägg till"</span> — klart! Triva visas nu som en app på din hemskärm.
                  </Step>
                  <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                    <Smartphone className="w-3.5 h-3.5" /> Fungerar på Android-telefoner
                  </div>
                </div>
              )}

              {platform === 'other' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Apple className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">iPhone / iPad</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed pl-6">
                      Tryck på Dela-knappen (<Share className="w-3 h-3 inline -mt-0.5" />) och välj <span className="font-medium">"Lägg till på hemskärmen"</span>.
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Smartphone className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">Android</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed pl-6">
                      Tryck på tre punkter (⋮) uppe till höger och välj <span className="font-medium">"Lägg till på hemskärmen"</span>.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5">
              <button
                onClick={handleClose}
                className="w-full bg-black hover:bg-gray-800 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-lg"
              >
                Jag förstår
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Step({ number, icon, children }: { number: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
        {number}
      </div>
      <div className="flex-1 pt-0.5">
        <p className="text-sm text-gray-600 leading-relaxed flex items-start gap-1.5">
          <span className="text-gray-400 mt-0.5">{icon}</span>
          <span>{children}</span>
        </p>
      </div>
    </div>
  );
}
