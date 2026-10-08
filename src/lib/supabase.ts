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
  sleep_note: string | null;
  energy_note: string | null;
  mood_note: string | null;
  stress_note: string | null;
  soreness_note: string | null;
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

export type DevelopmentArea = 'teknik' | 'spelförståelse' | 'fysik' | 'psykologi';

export const AREA_LABELS: Record<DevelopmentArea, string> = {
  teknik: 'Teknik',
  spelförståelse: 'Spelförståelse',
  fysik: 'Fysik',
  psykologi: 'Psykologi',
};

export const AREA_ICONS: Record<DevelopmentArea, string> = {
  teknik: 'BallFootball',
  spelförståelse: 'Brain',
  fysik: 'Dumbbell',
  psykologi: 'Heart',
};

export interface DevelopmentGoal {
  id: string;
  player_id: string;
  team_id: string;
  area: DevelopmentArea;
  football_action: string | null;
  target_description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type IupPlanStatus = 'ej_paborjat' | 'pagar' | 'klart';

export interface IupQuarterlyPlan {
  id: string;
  goal_id: string;
  player_id: string;
  team_id: string;
  quarter: number;
  focus: string;
  start_month: number;
  end_month: number;
  what_to_develop: string | null;
  how_to_develop: string | null;
  measurement: string | null;
  player_goal: string | null;
  player_evaluation: string | null;
  coach_evaluation: string | null;
  selected_skills: Partial<Record<SkillChecklistArea, string[]>>;
  status: IupPlanStatus;
  updated_by: 'coach' | 'player';
  created_at: string;
  updated_at: string;
}

export interface IupQuarterlyPlanChange {
  id: string;
  plan_id: string;
  goal_id: string;
  player_id: string;
  team_id: string;
  actor: 'coach' | 'player';
  changes: Record<string, { from?: unknown; to?: unknown } | unknown>;
  created_at: string;
}

export type SkillChecklistArea = 'psykologiska' | 'spelforstaelse' | 'teknik' | 'fysik';

export type SessionType = 'lag' | 'grupp' | 'individuell';

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  lag: 'Lagträning',
  grupp: 'Gruppträning',
  individuell: 'Individuell',
};

export interface TrainingSession {
  id: string;
  team_id: string;
  title: string;
  session_type: SessionType;
  scheduled_at: string;
  planned_duration_min: number;
  planned_rpe: number;
  content: string | null;
  purpose: string | null;
  exercises: string | null;
  goal_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingAssignment {
  id: string;
  session_id: string;
  player_id: string | null;
  is_all_team: boolean;
  created_at: string;
}

export interface TrainingCompletion {
  id: string;
  session_id: string;
  player_id: string;
  team_id: string;
  actual_duration_min: number | null;
  player_rpe: number | null;
  has_pain: boolean;
  pain_note: string | null;
  player_reflection: string | null;
  completed_at: string;
  created_at: string;
}

export interface Assessment {
  id: string;
  player_id: string;
  team_id: string;
  goal_id: string | null;
  area: DevelopmentArea;
  assessment_number: number;
  football_action: string | null;
  physical_quality: string | null;
  psychological_focus: string | null;
  coach_observation: string | null;
  coach_rating: number | null;
  player_reflection: string | null;
  training_done_summary: string | null;
  load_recovery_summary: string | null;
  feedback: string | null;
  next_steps: string | null;
  created_at: string;
  updated_at: string;
}
