import type { IupQuarterlyPlanChange } from '@/lib/supabase';

const FIELD_LABELS: Record<string, string> = {
  focus: 'Fokus för kvartalet',
  start_month: 'Startmånad',
  end_month: 'Slutmånad',
  what_to_develop: 'Utvecklingsmål',
  how_to_develop: 'Arbetssätt',
  measurement: 'Mätning',
  player_goal: 'Spelarens eget mål',
  player_evaluation: 'Spelarens utvärdering',
  coach_evaluation: 'Tränarens utvärdering',
  selected_skills: 'Valda färdigheter',
  status: 'Status',
};

function summarizeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'tomt';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'inga';
  if (typeof value === 'object') {
    const selected = Object.values(value).flatMap((items) => Array.isArray(items) ? items : []);
    return selected.length ? selected.join(', ') : 'uppdaterat';
  }
  return 'uppdaterat';
}

export default function IupChangeHistory({ changes }: { changes: IupQuarterlyPlanChange[] }) {
  if (changes.length === 0) {
    return <p className="text-xs text-gray-400">Ändringar från tränare och spelare visas här.</p>;
  }

  return (
    <ol className="space-y-3">
      {changes.map((change) => {
        const entries = Object.entries(change.changes);
        const wasCreated = entries.some(([key]) => key === 'created');
        const changedFields = entries
          .filter(([key]) => key !== 'created')
          .map(([key, value]) => {
            const details = value && typeof value === 'object' && !Array.isArray(value)
              ? value as { from?: unknown; to?: unknown }
              : {};
            return `${FIELD_LABELS[key] ?? key}: ${summarizeValue(details.to)}`;
          });

        return (
          <li key={change.id} className="border-l-2 border-[#d7e3d9] pl-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-xs font-bold text-gray-700">
                {change.actor === 'player' ? 'Spelaren ändrade' : 'Tränaren ändrade'}
              </span>
              <time className="text-xs text-gray-400" dateTime={change.created_at}>
                {new Date(change.created_at).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })}
              </time>
            </div>
            {wasCreated && changedFields.length === 0 ? (
              <p className="mt-1 text-xs text-gray-500">Kvartalsplan skapad</p>
            ) : changedFields.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {changedFields.map((field) => <li key={field} className="text-xs text-gray-500">{field}</li>)}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
