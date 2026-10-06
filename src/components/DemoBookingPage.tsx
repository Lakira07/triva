import type { FormEvent } from 'react';
import { ArrowLeft, Mail, Shield } from 'lucide-react';

export default function DemoBookingPage() {
  function handleDemoRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const body = [
      `Lag/förening: ${values.get('team')}`,
      `Idrott: ${values.get('sport') || 'Inte angivet'}`,
      `Antal spelare: ${values.get('players') || 'Inte angivet'}`,
      `Kontaktperson: ${values.get('contact')}`,
      `E-post: ${values.get('email')}`,
      `Telefon: ${values.get('phone') || 'Inte angivet'}`,
      `Ort/kommun: ${values.get('location')}`,
    ].join('\n');
    window.location.href = `mailto:hej@triva.se?subject=${encodeURIComponent('Boka en kostnadsfri demo')}&body=${encodeURIComponent(body)}`;
  }

  return (
    <main className="min-h-screen bg-[#f5f5f0] px-5 text-[#171717] sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between py-6">
        <a href="#" className="flex items-center gap-2.5" aria-label="Till Trivas startsida">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#171717] text-white shadow-lg shadow-black/10">
            <Shield className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="text-xl font-extrabold tracking-[-0.05em]">Triva</span>
        </a>
        <a href="#" className="inline-flex items-center gap-2 text-sm font-bold transition-colors hover:text-[#ef5b3f]">
          <ArrowLeft className="h-4 w-4" /> Till startsidan
        </a>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 py-10 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <section>
          <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#ef5b3f]">Boka en kostnadsfri demo</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-[-0.05em] sm:text-5xl">Berätta om ert lag.</h1>
          <p className="mt-4 max-w-md leading-7 text-[#686860]">Fyll i formuläret så hör vi av oss för att hitta en tid som passar.</p>
        </section>

        <form onSubmit={handleDemoRequest} className="grid content-start gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold sm:col-span-2">
            Lag eller förening
            <input name="team" required autoComplete="organization" className="rounded-lg border border-[#d8d8cd] bg-white px-4 py-3 font-normal outline-none focus:border-[#ef5b3f]" />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Idrott
            <input name="sport" className="rounded-lg border border-[#d8d8cd] bg-white px-4 py-3 font-normal outline-none focus:border-[#ef5b3f]" />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Antal spelare
            <input name="players" type="number" min="1" className="rounded-lg border border-[#d8d8cd] bg-white px-4 py-3 font-normal outline-none focus:border-[#ef5b3f]" />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Kontaktperson
            <input name="contact" required autoComplete="name" className="rounded-lg border border-[#d8d8cd] bg-white px-4 py-3 font-normal outline-none focus:border-[#ef5b3f]" />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            E-post
            <input name="email" type="email" required autoComplete="email" className="rounded-lg border border-[#d8d8cd] bg-white px-4 py-3 font-normal outline-none focus:border-[#ef5b3f]" />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Telefon <span className="font-normal text-[#85857b]">(valfritt)</span>
            <input name="phone" type="tel" autoComplete="tel" className="rounded-lg border border-[#d8d8cd] bg-white px-4 py-3 font-normal outline-none focus:border-[#ef5b3f]" />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Ort eller kommun
            <input name="location" required autoComplete="address-level2" className="rounded-lg border border-[#d8d8cd] bg-white px-4 py-3 font-normal outline-none focus:border-[#ef5b3f]" />
          </label>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ef5b3f] px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-[#ef5b3f]/20 transition-transform hover:-translate-y-0.5 sm:col-span-2 sm:justify-self-start">
            <Mail className="h-4 w-4" /> Skicka demo-förfrågan
          </button>
        </form>
      </div>
    </main>
  );
}
