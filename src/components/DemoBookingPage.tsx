import { useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Mail, Shield } from 'lucide-react';

export default function DemoBookingPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleDemoRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const endpoint = import.meta.env.VITE_GOOGLE_SHEETS_WEB_APP_URL?.trim();
    if (!endpoint) {
      setErrorMessage('Formuläret är inte anslutet ännu. Mejla hej@triva.se så hjälper vi dig.');
      return;
    }

    const payload = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (typeof value === 'string') payload.append(key, value);
    });

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: payload.toString(),
      });
      setSubmitted(true);
      form.reset();
    } catch {
      setErrorMessage('Det gick inte att skicka förfrågan. Försök igen eller mejla hej@triva.se.');
    } finally {
      setIsSubmitting(false);
    }
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

        {submitted ? (
          <div role="status" className="flex items-start gap-4 rounded-xl border border-[#cad7b0] bg-white p-6 sm:col-span-2">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#315c43]" />
            <div>
              <h2 className="font-extrabold">Tack för din förfrågan!</h2>
              <p className="mt-1 text-sm leading-6 text-[#686860]">Vi har tagit emot den och hör av oss för att hitta en tid som passar.</p>
            </div>
          </div>
        ) : (
        <form onSubmit={handleDemoRequest} className="grid content-start gap-5 sm:grid-cols-2">
          <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
            <label htmlFor="website">Lämna detta fält tomt</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
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
          {errorMessage && <p role="alert" className="text-sm font-semibold text-red-700 sm:col-span-2">{errorMessage}</p>}
          <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ef5b3f] px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-[#ef5b3f]/20 transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 sm:col-span-2 sm:justify-self-start">
            <Mail className="h-4 w-4" /> {isSubmitting ? 'Skickar...' : 'Skicka demo-förfrågan'}
          </button>
        </form>
        )}
      </div>
    </main>
  );
}
