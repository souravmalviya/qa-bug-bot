import React, { useState } from 'react';
import { BDDScenario } from '../types';
import { generateBDDSteps } from '../services/geminiService';

const BDDGenerator: React.FC = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BDDScenario | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const bdd = await generateBDDSteps(input);
      setResult(bdd);
    } catch (err: any) {
      setError(err?.message || "Failed to generate BDD steps. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-20">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-[#0F172A] mb-4">BDD Step Generator</h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          Transform your feature requirements into clean, ready-to-use Gherkin scenarios in seconds.
        </p>
      </div>

      <div className="space-y-10">
        {/* Input Section */}
        <section>
          <form onSubmit={handleSubmit} className="glass p-8 rounded-3xl border border-gray-100 bg-white">
            <div className="space-y-4">
              <label className="block text-sm font-bold text-[#0F172A] flex justify-between">
                <span>Feature Summary / Requirements</span>
                <span className={`text-xs font-normal ${input.length >= 2000 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                  {input.length} / 2000
                </span>
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={2000}
                placeholder="e.g., A login page where users can sign in with email/password. Should include 'forgot password' link and handle invalid credentials."
                className={`w-full bg-white border rounded-2xl p-6 h-64 outline-none text-[#0F172A] resize-none transition-all placeholder:text-slate-300 text-lg ${input.length >= 2000 ? 'border-red-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                  }`}
              />
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setInput('')}
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
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {!input.trim() ? 'Enter features to generate' : 'Generate BDD Steps'}
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
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Gherkin Output</span>
                </div>
                <button
                  onClick={() => {
                    const text = `Feature: ${result.feature}\n\nScenario: ${result.scenario}\n${result.steps.map(s => `  ${s.keyword} ${s.text}`).join('\n')}`;
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
              <div className="p-10 space-y-8">
                <div>
                  <div className="flex gap-2 mb-2">
                    <span className="gherkin-keyword text-xs uppercase tracking-wider opacity-60">Feature</span>
                  </div>
                  <h3 className="text-2xl font-bold text-[#0F172A]">{result.feature}</h3>
                </div>

                <div>
                  <div className="flex gap-2 mb-2">
                    <span className="gherkin-keyword text-xs uppercase tracking-wider opacity-60">Scenario</span>
                  </div>
                  <h4 className="text-xl font-semibold text-slate-700">{result.scenario}</h4>
                </div>

                <div className="space-y-3 pt-8 border-t border-gray-100">
                  {result.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-4 text-base items-baseline">
                      <span className="gherkin-keyword min-w-[80px] text-indigo-600 font-bold">{step.keyword}</span>
                      <span className="text-slate-600 leading-relaxed">{step.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-gray-200 rounded-3xl p-12 bg-white/50">
              <svg className="w-16 h-16 mb-4 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-slate-400 font-medium">Your Gherkin scenario will appear here</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default BDDGenerator;
