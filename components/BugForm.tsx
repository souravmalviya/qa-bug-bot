import React, { useState } from 'react';
import { BugReport } from '../types';
import { generateBugReport } from '../services/geminiService';

const BugForm: React.FC = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BugReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const report = await generateBugReport(input);
      setResult(report);
    } catch (err: any) {
      setError(err?.message || "Failed to generate bug report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const severityColors = {
    Low: 'bg-green-50 text-green-700 border-green-100',
    Medium: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    High: 'bg-orange-50 text-orange-700 border-orange-100',
    Critical: 'bg-red-50 text-red-700 border-red-100'
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-[#0F172A] mb-4">Bug Creator</h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          Turn scattered observations into professional, structured bug reports ready for Jira or GitHub.
        </p>
      </div>

      <div className="space-y-10">
        {/* Input Section */}
        <section>
          <form onSubmit={handleSubmit} className="glass p-8 rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="space-y-4">
              <label className="block text-sm font-bold text-[#0F172A] flex justify-between">
                <span>Issue Description / Observations</span>
                <span className={`text-xs font-normal ${input.length >= 2000 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                  {input.length} / 2000
                </span>
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                maxLength={2000}
                placeholder="e.g., The app crashes when I try to upload a profile picture larger than 5MB on the settings page. I tried it 3 times and it happened every time on Chrome."
                className={`w-full bg-white border rounded-2xl p-6 h-64 outline-none text-[#0F172A] resize-none transition-all placeholder:text-slate-300 text-lg ${input.length >= 2000 ? 'border-red-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                  }`}
              />

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setInput('');
                    setResult(null);
                  }}
                  className="flex-1 py-4 px-6 rounded-2xl font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-all active:scale-[0.98]"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className={`flex-[2] py-4 px-6 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${isLoading || !input.trim()
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-[#D1D5DB] hover:bg-[#C4C9D1] text-[#0F172A] shadow-sm'
                    }`}
                >
                  {isLoading ? (
                    <svg className="animate-spin h-5 w-5 text-[#0F172A]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {!input.trim() ? 'Enter observations to generate' : 'Generate Bug Report'}
                    </>
                  )}
                </button>
              </div>
            </div>
            {error && (
              <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3 text-red-700 animate-in fade-in">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm font-medium leading-relaxed">{error}</div>
              </div>
            )}
          </form>
        </section>

        {/* Output Section */}
        <section>
          {result ? (
            <div className="glass rounded-3xl border border-gray-100 bg-white shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 bg-slate-50 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Generated Report</span>
                </div>
                <button
                  onClick={() => {
                    const text = `BUG: ${result.summary}\n\nSEVERITY: ${result.severity}\n\nSTEPS:\n${result.stepsToReproduce.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nEXPECTED: ${result.expectedResult}\nACTUAL: ${result.actualResult}`;
                    navigator.clipboard.writeText(text);
                  }}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all rounded-lg"
                  title="Copy to clipboard"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>

              <div className="p-10 space-y-10">
                <div className="flex flex-wrap gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${severityColors[result.severity]}`}>
                    {result.severity}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold border border-indigo-100 bg-indigo-50 text-indigo-600 uppercase">
                    {result.category}
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Summary</h3>
                  <h2 className="text-2xl font-bold text-[#0F172A] leading-tight">
                    {result.summary}
                  </h2>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    Steps to Reproduce
                  </h3>
                  <ol className="space-y-3">
                    {result.stepsToReproduce.map((step, idx) => (
                      <li key={idx} className="flex gap-4 text-slate-600">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                          {idx + 1}
                        </span>
                        <p className="pt-0.5">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="grid sm:grid-cols-2 gap-8 pt-4 border-t border-gray-50">
                  <section>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Expected Result
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{result.expectedResult}</p>
                  </section>

                  <section>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Actual Result
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{result.actualResult}</p>
                  </section>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-gray-200 rounded-3xl p-12 bg-white/50">
              <svg className="w-16 h-16 mb-4 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-slate-400 font-medium">Your bug report will appear here</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default BugForm;
