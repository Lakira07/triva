import { useState, useCallback } from 'react';
import { Sparkles, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chat, isAIConfigured, type ChatMessage } from '@/lib/ai';

interface AIInsightCardProps {
  context: string;
  prompt: string;
  title?: string;
  className?: string;
}

export default function AIInsightCard({ context, prompt, title = 'AI-insikt', className = '' }: AIInsightCardProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInsight(null);

    const messages: ChatMessage[] = [
      { role: 'system', content: context },
      { role: 'user', content: prompt },
    ];

    try {
      const result = await chat(messages, { temperature: 0.7, maxTokens: 1200 });
      setInsight(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta AI-insikt');
    } finally {
      setLoading(false);
    }
  }, [context, prompt]);

  if (!isAIConfigured()) {
    return null;
  }

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" strokeWidth={2.5} />
          </div>
          <h4 className="font-bold text-black text-sm">{title}</h4>
        </div>
        <button
          onClick={fetchInsight}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-black disabled:opacity-40 transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {insight ? 'Uppdatera' : 'Hämta'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2.5 mb-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: `${85 - i * 15}%` }} />
          ))}
        </div>
      )}

      {!loading && !insight && !error && (
        <button
          onClick={fetchInsight}
          className="w-full text-left text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
        >
          Klicka på "Hämta" för att få AI-analys baserad på aktuell data.
        </button>
      )}

      {!loading && insight && (
        <div className="prose prose-sm max-w-none text-sm text-gray-700 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_h1]:text-black [&_h2]:text-black [&_h3]:text-black [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_p]:my-1.5 [&_strong]:font-bold [&_table]:text-left [&_th]:font-bold [&_th]:text-gray-700 [&_td]:text-gray-600 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-200 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{insight}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
