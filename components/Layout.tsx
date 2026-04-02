import React from 'react';
import { ViewState } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  onNavigate: (view: ViewState) => void;
  currentView: ViewState;
}

const Layout: React.FC<LayoutProps> = ({ children, onNavigate, currentView }) => {
  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-500/30">
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => onNavigate('bdd')}
            >
              <div className="w-10 h-10 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Onclusive Logo"
                  className="w-10 h-10 object-contain rounded-sm shadow-sm"
                />
              </div>
              <span className="text-xl font-bold text-[#0F172A] tracking-tight">Onclusive QA</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => onNavigate('bdd')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'bdd'
                  ? 'bg-[#EEF2FF] text-[#4F46E5]'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                BDD Generator
              </button>
              <button
                onClick={() => onNavigate('generator')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'generator'
                  ? 'bg-[#EEF2FF] text-[#4F46E5]'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                Bug Creator
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="border-t border-gray-100 bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">
            © 2026 Onclusive QA Bugbot. Empowering quality through Ai-intelligence.
          </p>
          <p className="text-slate-500 text-xs mt-2 font-medium">
            Created with ❤️ By Sourav Malviya
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
