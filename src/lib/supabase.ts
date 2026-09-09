import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type QuestionType = 'text' | 'rating' | 'choice';

export interface Team {
  id: string;
  name: string;
  join_code: string;
  trainer_code: string;
  owner_id: string | null;
  created_at: string;
  code_expires_at: string | null;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: string[] | null;
  order_index: number;
  team_id: string | null;
  created_at: string;
}

export interface Response {
  id: string;
  player_name: string | null;
  player_id: string | null;
  team_id: string | null;
  created_at: string;
}

export interface Answer {
  id: string;
  response_id: string;
  question_id: string;
  answer_text: string;
  created_at: string;
}

export interface ResponseWithAnswers extends Response {
  answers: Answer[];
}

export interface Player {
  id: string;
  name: string;
  position: string | null;
  jersey_number: number | null;
  team_id: string | null;
  created_at: string;
}

export interface WellbeingEntry {
  id: string;
  player_id: string;
  team_id: string | null;
  sleep: number;
  energy: number;
  mood: number;
  stress: number;
  soreness: number;
  note: string | null;
  created_at: string;
}

export interface WellbeingMetric {
  key: keyof Pick<WellbeingEntry, 'sleep' | 'energy' | 'mood' | 'stress' | 'soreness'>;
  label: string;
}

export const WELLBEING_METRICS: WellbeingMetric[] = [
  { key: 'sleep', label: 'Sömn' },
  { key: 'energy', label: 'Energi' },
  { key: 'mood', label: 'Sinneslag' },
  { key: 'stress', label: 'Stress' },
  { key: 'soreness', label: 'Stelhet' },
];

export interface AppSettings {
  weekly_survey_required: number;
  weekly_wellbeing_required: number;
}
