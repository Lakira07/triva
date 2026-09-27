import {
  ArrowRight,
  BarChart3,
  Check,
  HeartPulse,
  Mail,
  Shield,
  Sparkles,
  User,
  Users,
} from 'lucide-react';

interface WelcomePageProps {
  onSelectPlayer: () => void;
  onSelectTrainer: () => void;
}

export default function WelcomePage({ onSelectPlayer, onSelectTrainer }: WelcomePageProps) {
  return (
    <div className="min-h-screen overflow-hidden bg-[#f5f5f0] text-[#171717]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <a href="#" className="flex items-center gap-2.5" aria-label="Triva startsida">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#171717] text-white shadow-lg shadow-black/10">
            <Shield className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="text-xl font-extrabold tracking-[-0.05em]">Triva</span>
        </a>
        <a
          href="mailto:hej@triva.se?subject=Jag vill boka en demo"
          className="hidden items-center gap-2 text-sm font-bold text-[#171717] transition-colors hover:text-[#ef5b3f] sm:flex"
        >
          Boka en demo <ArrowRight className="h-4 w-4" />
        </a>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20 lg:pb-28">
          <div className="relative z-10 animate-[slideUp_0.7s_ease-out_both]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d8d8cd] bg-white/70 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#ef5b3f]">
              <Sparkles className="h-3.5 w-3.5" /> Välmående som märks
            </div>
            <h1 className="max-w-2xl text-5xl font-extrabold leading-[0.98] tracking-[-0.06em] sm:text-7xl">
              Bättre lag börjar med att må bra.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#686860] sm:text-xl">
              Triva hjälper tränare att förstå hur laget mår, fånga upp signaler i tid och skapa en tryggare vardag för varje spelare.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="mailto:hej@triva.se?subject=Jag vill boka en demo"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ef5b3f] px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-[#ef5b3f]/20 transition-transform hover:-translate-y-0.5"
              >
                <Mail className="h-4 w-4" /> Boka en kostnadsfri demo
              </a>
              <a
                href="#sa-fungerar-det"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d8d8cd] bg-white/60 px-5 py-3.5 text-sm font-extrabold transition-colors hover:border-[#171717]"
              >
                Så fungerar det <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="relative min-h-[360px] animate-[scaleIn_0.8s_0.1s_ease-out_both] sm:min-h-[430px]">
            <div className="absolute right-0 top-0 h-64 w-64 rounded-[2.5rem] bg-[#ef5b3f] sm:h-80 sm:w-80" />
            <div className="absolute bottom-0 left-0 z-10 w-[87%] rounded-[1.75rem] bg-[#171717] p-5 text-white shadow-2xl shadow-black/20 sm:p-7">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">Lagets puls</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">Vecka 38</p>
                </div>
                <div className="rounded-full bg-[#d7f06c] px-3 py-1.5 text-xs font-extrabold text-[#171717]">+12%</div>
              </div>
              <div className="flex h-28 items-end gap-2 border-b border-white/10 pb-0 sm:h-36">
                {[42, 58, 48, 72, 64, 88, 78, 96, 82, 100].map((height, index) => (
                  <div key={height + index} className="flex-1 rounded-t-md bg-[#d7f06c]" style={{ height: `${height}%` }} />
                ))}
              </div>
              <div className="mt-4 flex justify-between text-xs font-semibold text-white/45">
                <span>Mån</span><span>Ons</span><span>Fre</span><span>Sön</span>
              </div>
            </div>
            <div className="absolute bottom-8 right-0 z-20 flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-xl shadow-black/10 sm:bottom-10 sm:right-[-1rem]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d7f06c]"><HeartPulse className="h-5 w-5" /></span>
              <div><p className="text-xs font-bold text-[#85857b]">Svarsfrekvens</p><p className="text-lg font-extrabold">94%</p></div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#deded4] bg-white/55" id="sa-fungerar-det">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#ef5b3f]">Enklare för alla</p>
                <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-[-0.05em] sm:text-5xl">Från magkänsla till insikt.</h2>
              </div>
              <div className="grid gap-8 sm:grid-cols-3">
                <div><HeartPulse className="h-7 w-7 text-[#ef5b3f]" /><h3 className="mt-5 text-lg font-extrabold">Känn av läget</h3><p className="mt-2 text-sm leading-6 text-[#686860]">Spelare svarar snabbt och anonymt på frågor om sin vardag.</p></div>
                <div><BarChart3 className="h-7 w-7 text-[#ef5b3f]" /><h3 className="mt-5 text-lg font-extrabold">Se mönstren</h3><p className="mt-2 text-sm leading-6 text-[#686860]">Tränare får en tydlig bild av gruppens utveckling över tid.</p></div>
                <div><Check className="h-7 w-7 text-[#ef5b3f]" /><h3 className="mt-5 text-lg font-extrabold">Agera tidigt</h3><p className="mt-2 text-sm leading-6 text-[#686860]">Gör rätt insats innan små signaler blir stora problem.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col items-start justify-between gap-8 rounded-[1.75rem] bg-[#d7f06c] px-6 py-8 sm:flex-row sm:items-center sm:px-10 sm:py-10">
            <div><p className="text-sm font-extrabold uppercase tracking-[0.14em] text-black/55">Nyfiken på Triva?</p><h2 className="mt-2 text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl">Se hur det kan fungera för ert lag.</h2></div>
            <a href="mailto:hej@triva.se?subject=Jag vill boka en demo" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#171717] px-5 py-3.5 text-sm font-extrabold text-white transition-transform hover:-translate-y-0.5"><Mail className="h-4 w-4" /> Kontakta oss</a>
          </div>
        </section>

        <section className="border-t border-[#deded4] bg-[#171717] px-5 py-8 text-white sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-extrabold">Redan en del av Triva?</p><p className="mt-1 text-sm text-white/55">Gå direkt till din portal.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={onSelectPlayer} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-bold transition-colors hover:bg-white/10"><User className="h-4 w-4" /> Spelarportal</button>
              <button onClick={onSelectTrainer} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#171717] transition-transform hover:-translate-y-0.5"><Users className="h-4 w-4" /> Tränarportal</button>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
