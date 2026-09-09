import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Check,
  ListChecks,
  MessageSquare,
  Star,
  ChevronUp,
  ChevronDown,
  Eye,
  Inbox,
  Loader2,
  LogOut,
  Shield,
  Users,
  TrendingUp,
  Settings,
  BarChart3,
  Sparkles,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { supabase, type Question, type QuestionType, type ResponseWithAnswers, type Team } from '@/lib/supabase';
import PlayersView from '@/components/PlayersView';
import WellbeingView from '@/components/WellbeingView';
import SettingsView from '@/components/SettingsView';
import SurveyAnalyticsView from '@/components/SurveyAnalyticsView';
import AICoachView from '@/components/AICoachView';

type Tab = 'questions' | 'responses' | 'players' | 'wellbeing' | 'analytics' | 'ai' | 'settings';

interface AdminDashboardProps {
  team: Team;
  onLogout: () => void;
}

export default function AdminDashboard({ team, onLogout }: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>('questions');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<ResponseWithAnswers[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<ResponseWithAnswers | null>(null);

  const playerLink = `${window.location.origin}${window.location.pathname}#/player`;

  const fetchQuestions = useCallback(async () => {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('team_id', team.id)
      .order('order_index', { ascending: true });
    if (error) {
      console.error('Error fetching questions:', error);
      return;
    }
    setQuestions(data as Question[]);
  }, [team.id]);

  const fetchResponses = useCallback(async () => {
    const { data: respData, error: respError } = await supabase
      .from('responses')
      .select('*')
      .eq('team_id', team.id)
      .order('created_at', { ascending: false });
    if (respError) {
      console.error('Error fetching responses:', respError);
      return;
    }

    const respIds = (respData || []).map((r: any) => r.id);
    let ansData: any[] = [];
    if (respIds.length > 0) {
      const { data: ad, error: ansError } = await supabase
        .from('answers')
        .select('*')
        .in('response_id', respIds);
      if (ansError) {
        console.error('Error fetching answers:', ansError);
      } else {
        ansData = ad || [];
      }
    }

    const withAnswers: ResponseWithAnswers[] = (respData || []).map((r: any) => ({
      ...r,
      answers: ansData.filter((a: any) => a.response_id === r.id),
    }));
    setResponses(withAnswers);
  }, [team.id]);

  useEffect(() => {
    (async () => {
      await fetchQuestions();
      await fetchResponses();
      setLoading(false);
    })();
  }, [fetchQuestions, fetchResponses]);

  const copyLink = () => {
    navigator.clipboard.writeText(playerLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyJoinCode = () => {
    navigator.clipboard.writeText(team.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyTrainerCode = () => {
    navigator.clipboard.writeText(team.trainer_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addQuestion = async (text: string, type: QuestionType, options: string[] | null) => {
    const orderIndex = questions.length;
    const { error } = await supabase
      .from('questions')
      .insert({ text, type, options, order_index: orderIndex, team_id: team.id });
    if (error) {
      console.error('Error adding question:', error);
      return;
    }
    setShowNewForm(false);
    await fetchQuestions();
  };

  const deleteQuestion = async (id: string) => {
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) {
      console.error('Error deleting question:', error);
      return;
    }
    await fetchQuestions();
  };

  const moveQuestion = async (question: Question, direction: 'up' | 'down') => {
    const index = questions.findIndex((q) => q.id === question.id);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= questions.length) return;
    const swapQ = questions[swapIndex];

    const updates = [
      supabase.from('questions').update({ order_index: swapQ.order_index }).eq('id', question.id),
      supabase.from('questions').update({ order_index: question.order_index }).eq('id', swapQ.id),
    ];
    await Promise.all(updates);
    await fetchQuestions();
  };

  const deleteResponse = async (id: string) => {
    const { error } = await supabase.from('responses').delete().eq('id', id);
    if (error) {
      console.error('Error deleting response:', error);
      return;
    }
    setSelectedResponse(null);
    await fetchResponses();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-black animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center ring-2 ring-black/10 shadow-card">
              <Shield className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl text-display text-black">Tränarpanel</h1>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {team.name}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1 text-sm font-semibold text-gray-400 hover:text-black transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logga ut
          </button>
        </div>
        <p className="text-gray-500 ml-15 font-medium">Hantera frågor och se spelarnas svar</p>
      </div>

      {/* Share link + codes card */}
      <div className="mb-8 bg-white rounded-3xl border border-gray-200 p-5 shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-gray-400" strokeWidth={2.5} />
          <h3 className="text-sm font-bold text-gray-700">Spelarlink & koder</h3>
        </div>
        <p className="text-sm text-gray-500 mb-3 font-medium">
          Dela länken med dina spelare. De behöver spelarkoden för att logga in.
        </p>
        <div className="flex items-center gap-2 mb-3">
          <input
            readOnly
            value={playerLink}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 font-mono"
          />
          <button
            onClick={copyLink}
            className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" /> Kopierad
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Kopiera
              </>
            )}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Spelarkod:</span>
            <button
              onClick={copyJoinCode}
              className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-black text-gray-700 px-2.5 py-1 rounded-md text-sm font-mono font-bold transition-colors"
            >
              {team.join_code}
              <Copy className="w-3 h-3 text-gray-400" />
            </button>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Tränarkod:</span>
            <button
              onClick={copyTrainerCode}
              className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-black text-gray-700 px-2.5 py-1 rounded-md text-sm font-mono font-bold transition-colors"
            >
              {team.trainer_code}
              <Copy className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        </div>

        {team.code_expires_at && (
          (() => {
            const isExpired = new Date(team.code_expires_at).getTime() <= Date.now();
            const daysLeft = Math.ceil((new Date(team.code_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return (
              <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 ${isExpired ? 'bg-red-50 border border-red-200' : daysLeft <= 3 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-200'}`}>
                {isExpired ? (
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                ) : (
                  <Clock className={`w-4 h-4 flex-shrink-0 ${daysLeft <= 3 ? 'text-amber-500' : 'text-gray-400'}`} />
                )}
                <p className={`text-xs font-bold ${isExpired ? 'text-red-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-gray-600'}`}>
                  {isExpired
                    ? 'Koderna har löpt ut'
                    : daysLeft === 0
                    ? 'Koderna löper ut idag'
                    : `Koderna giltiga i ${daysLeft} dag${daysLeft === 1 ? '' : 'ar'} (${new Date(team.code_expires_at).toLocaleDateString('sv-SE')})`}
                </p>
              </div>
            );
          })()
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 mb-6 border-b-2 border-gray-100 overflow-x-auto">
        <button
          onClick={() => setTab('questions')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            tab === 'questions'
              ? 'border-black text-black'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          <ListChecks className="w-4 h-4" strokeWidth={2.5} />
          Frågor ({questions.length})
        </button>
        <button
          onClick={() => setTab('responses')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            tab === 'responses'
              ? 'border-black text-black'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          <Inbox className="w-4 h-4" strokeWidth={2.5} />
          Svar ({responses.length})
        </button>
        <button
          onClick={() => setTab('players')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            tab === 'players'
              ? 'border-black text-black'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" strokeWidth={2.5} />
          Spelare
        </button>
        <button
          onClick={() => setTab('wellbeing')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            tab === 'wellbeing'
              ? 'border-black text-black'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" strokeWidth={2.5} />
          Välmående
        </button>
        <button
          onClick={() => setTab('analytics')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            tab === 'analytics'
              ? 'border-black text-black'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          <BarChart3 className="w-4 h-4" strokeWidth={2.5} />
          Analys
        </button>
        <button
          onClick={() => setTab('ai')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            tab === 'ai'
              ? 'border-black text-black'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          <Sparkles className="w-4 h-4" strokeWidth={2.5} />
          AI-coach
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            tab === 'settings'
              ? 'border-black text-black'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          <Settings className="w-4 h-4" strokeWidth={2.5} />
          Inställningar
        </button>
      </div>

      {/* Questions tab */}
      {tab === 'questions' && (
        <div>
          {questions.length === 0 && !showNewForm && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
              <ListChecks className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">Inga frågor ännu. Skapa din första fråga!</p>
            </div>
          )}

          <div className="space-y-3 mb-4">
            {questions.map((q, i) => (
              <div
                key={q.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 shadow-sm"
              >
                <div className="flex flex-col gap-1 pt-1">
                  <button
                    onClick={() => moveQuestion(q, 'up')}
                    disabled={i === 0}
                    className="text-gray-400 hover:text-black disabled:opacity-30 transition-colors"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveQuestion(q, 'down')}
                    disabled={i === questions.length - 1}
                    className="text-gray-400 hover:text-black disabled:opacity-30 transition-colors"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-400">#{i + 1}</span>
                    <TypeBadge type={q.type} />
                  </div>
                  <p className="text-black font-medium">{q.text}</p>
                  {q.options && q.options.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {q.options.map((opt, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteQuestion(q.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {showNewForm ? (
            <NewQuestionForm onAdd={addQuestion} onCancel={() => setShowNewForm(false)} />
          ) : (
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 w-full bg-white border-2 border-dashed border-gray-300 hover:border-black hover:bg-gray-50 text-gray-500 hover:text-black px-4 py-3 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Lägg till fråga
            </button>
          )}
        </div>
      )}

      {/* Players tab */}
      {tab === 'players' && <PlayersView teamId={team.id} />}

      {/* Wellbeing tab */}
      {tab === 'wellbeing' && <WellbeingView teamId={team.id} />}

      {/* Analytics tab */}
      {tab === 'analytics' && <SurveyAnalyticsView teamId={team.id} />}

      {/* AI Coach tab */}
      {tab === 'ai' && <AICoachView teamId={team.id} />}

      {/* Settings tab */}
      {tab === 'settings' && <SettingsView teamId={team.id} />}

      {/* Responses tab */}
      {tab === 'responses' && (
        <div>
          {responses.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
              <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Inga svar inkomna ännu.</p>
            </div>
          ) : selectedResponse ? (
            <ResponseDetail
              response={selectedResponse}
              questions={questions}
              onBack={() => setSelectedResponse(null)}
              onDelete={() => deleteResponse(selectedResponse.id)}
            />
          ) : (
            <div className="space-y-3">
              {responses.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedResponse(r)}
                  className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:border-black hover:shadow-md transition-all text-left"
                >
                  <div>
                    <p className="font-medium text-black">
                      {r.player_name || 'Anonym spelare'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {r.answers.length} svar ·{' '}
                      {new Date(r.created_at).toLocaleDateString('sv-SE', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: QuestionType }) {
  const config = {
    text: { icon: MessageSquare, label: 'Text', color: 'bg-gray-100 text-gray-700' },
    rating: { icon: Star, label: 'Betyg', color: 'bg-gray-100 text-gray-700' },
    choice: { icon: ListChecks, label: 'Val', color: 'bg-gray-100 text-gray-700' },
  };
  const { icon: Icon, label, color } = config[type];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${color}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function NewQuestionForm({
  onAdd,
  onCancel,
}: {
  onAdd: (text: string, type: QuestionType, options: string[] | null) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [type, setType] = useState<QuestionType>('text');
  const [options, setOptions] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const cleanOptions =
      type === 'choice' ? options.filter((o) => o.trim()) : null;
    await onAdd(text.trim(), type, cleanOptions);
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <h3 className="font-semibold text-black mb-4">Ny fråga</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Frågetext</label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="T.ex. Hur känner du inför nästa match?"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Svarstyp</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'text', label: 'Text', icon: MessageSquare },
              { value: 'rating', label: 'Betyg 1–5', icon: Star },
              { value: 'choice', label: 'Flervals', icon: ListChecks },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setType(value)}
                className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  type === value
                    ? 'border-black bg-gray-50 text-black'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </div>
        </div>
        {type === 'choice' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Alternativ</label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[idx] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Alternativ ${idx + 1}`}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                  {options.length > 1 && (
                    <button
                      onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setOptions([...options, ''])}
                className="flex items-center gap-1 text-sm text-black hover:text-gray-700 font-medium"
              >
                <Plus className="w-4 h-4" /> Lägg till alternativ
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || saving}
            className="flex items-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Spara fråga
          </button>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

function ResponseDetail({
  response,
  questions,
  onBack,
  onDelete,
}: {
  response: ResponseWithAnswers;
  questions: Question[];
  onBack: () => void;
  onDelete: () => void;
}) {
  const getAnswer = (questionId: string) =>
    response.answers.find((a) => a.question_id === questionId);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-black font-medium"
        >
          ← Tillbaka
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium"
        >
          <Trash2 className="w-4 h-4" /> Radera svar
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 className="font-bold text-lg text-black mb-1">
          {response.player_name || 'Anonym spelare'}
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {new Date(response.created_at).toLocaleString('sv-SE')}
        </p>
        <div className="space-y-5">
          {questions.map((q, i) => {
            const answer = getAnswer(q.id);
            return (
              <div key={q.id} className="border-t border-gray-100 pt-4 first:border-0 first:pt-0">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {i + 1}. {q.text}
                </p>
                {answer ? (
                  q.type === 'rating' ? (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`w-5 h-5 ${
                            n <= parseInt(answer.answer_text)
                              ? 'fill-black text-black'
                              : 'text-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-black bg-gray-50 rounded-lg px-3 py-2 text-sm">
                      {answer.answer_text}
                    </p>
                  )
                ) : (
                  <p className="text-gray-400 text-sm italic">Ej besvarad</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
