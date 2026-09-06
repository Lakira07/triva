import { useEffect, useState } from 'react';
import {
  Star,
  Send,
  Loader2,
  CheckCircle2,
  ListChecks,
} from 'lucide-react';
import { supabase, type Question } from '@/lib/supabase';

export default function SurveyView() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('order_index', { ascending: true });
      if (error) {
        console.error('Error fetching questions:', error);
        setLoading(false);
        return;
      }
      setQuestions(data as Question[]);
      setLoading(false);
    })();
  }, []);

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const allAnswered = questions.every((q) => answers[q.id] && answers[q.id].trim());

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    const { data: respData, error: respError } = await supabase
      .from('responses')
      .insert({ player_name: playerName.trim() || null })
      .select()
      .single();
    if (respError) {
      console.error('Error creating response:', respError);
      setSubmitting(false);
      return;
    }
    const answerRows = questions.map((q) => ({
      response_id: respData.id,
      question_id: q.id,
      answer_text: answers[q.id],
    }));
    const { error: ansError } = await supabase.from('answers').insert(answerRows);
    if (ansError) {
      console.error('Error saving answers:', ansError);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-black animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 sm:px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-black mb-2">Tack för dina svar!</h1>
        <p className="text-gray-500">Dina svar har skickats in till tränaren.</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 sm:px-6 text-center">
        <ListChecks className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Det finns inga frågor att besvara just nu.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center ring-2 ring-black/10">
            <ListChecks className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black tracking-tight">Spelarenkät</h1>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Österåker United · U2
            </p>
          </div>
        </div>
        <p className="text-gray-500 ml-14">Svara på alla frågor och skicka in.</p>
      </div>

      {/* Player name */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Ditt namn <span className="text-gray-400">(frivilligt)</span>
        </label>
        <input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="T.ex. Anders Svensson"
          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
        />
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-start gap-2 mb-4">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-black text-white text-sm font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div className="flex-1 pt-0.5">
                <p className="font-medium text-black">{q.text}</p>
              </div>
            </div>
            <div className="pl-9">
              {q.type === 'text' && (
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Skriv ditt svar här..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                />
              )}
              {q.type === 'rating' && (
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAnswer(q.id, String(n))}
                      className="group transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          n <= parseInt(answers[q.id] || '0')
                            ? 'fill-black text-black'
                            : 'text-gray-200 group-hover:text-gray-400'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-sm text-gray-400 ml-2">
                    {answers[q.id] ? `${answers[q.id]}/5` : ''}
                  </span>
                </div>
              )}
              {q.type === 'choice' && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center gap-3 border-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                        answers[q.id] === opt
                          ? 'border-black bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswer(q.id, opt)}
                        className="accent-black"
                      />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        className="mt-6 w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
      >
        {submitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Send className="w-5 h-5" /> Skicka in svar
          </>
        )}
      </button>
      {!allAnswered && questions.length > 0 && (
        <p className="text-center text-sm text-gray-400 mt-3">
          Besvara alla frågor för att skicka in.
        </p>
      )}
    </div>
  );
}
