import React, { useState } from 'react';
import { SignIn, SignUp } from '@clerk/react';

type AuthView = 'signin' | 'signup';

const clerkAppearance = {
  variables: {
    colorPrimary: '#16a34a',
    colorBackground: '#ffffff',
    colorText: '#0f172a',
    colorTextSecondary: '#64748b',
    colorInputBackground: '#f8fafc',
    colorInputText: '#0f172a',
    colorDanger: '#ef4444',
    borderRadius: '0.75rem',
    fontFamily: '"Inter", sans-serif',
    fontSize: '0.9375rem',
  },
  elements: {
    rootBox: { width: '100%' },
    card: {
      boxShadow: 'none',
      border: 'none',
      borderRadius: '0',
      background: 'transparent',
      margin: '0',
      width: '100%',
      // padding intentionally NOT overridden — Clerk's internal spacing keeps fields away from edges
    },
    headerTitle: { display: 'none' },
    headerSubtitle: { display: 'none' },
    header: { display: 'none' },
    footer: { display: 'none' },
    formButtonPrimary: {
      background: '#16a34a',
      color: '#ffffff',
    },
    socialButtonsBlockButton: {
      borderColor: '#d1fae5',
      color: '#0f172a',
    },
    dividerLine: { background: '#e2e8f0' },
    dividerText: { color: '#94a3b8' },
  },
};

interface AuthPageProps {
  initialView?: AuthView;
}

const AuthPage: React.FC<AuthPageProps> = ({ initialView = 'signin' }) => {
  const [view, setView] = useState<AuthView>(initialView);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50/40 flex flex-col items-center justify-center px-4 py-12">

      {/* Decorative background blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-green-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl" />
      </div>

      {/* Single unified card — overflow-hidden clips both sections into one shape */}
      <div className="w-full max-w-md animate-fade-in overflow-hidden rounded-3xl shadow-2xl shadow-green-900/10">

        {/* Green brand header */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 px-8 py-8 text-white text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-inner">
              <img
                src="/logo.png"
                alt="Onclusive"
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Onclusive QA</h1>
          <p className="text-green-100 mt-1.5 text-sm font-medium">
            {view === 'signin' ? 'Welcome back — sign in to continue' : 'Create your account to get started'}
          </p>

          {/* Tab switcher */}
          <div className="mt-6 flex gap-1 bg-white/10 rounded-xl p-1">
            <button
              onClick={() => setView('signin')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                view === 'signin'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-green-100 hover:text-white hover:bg-white/10'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setView('signup')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                view === 'signup'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-green-100 hover:text-white hover:bg-white/10'
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* White form body */}
        <div className="bg-white">

          {/* Clerk form — CSS class enables flat override via index.css */}
          <div className="clerk-form-container pt-4 pb-2">
            {view === 'signin' ? (
              <SignIn
                routing="hash"
                forceRedirectUrl="/"
                appearance={clerkAppearance}
              />
            ) : (
              <SignUp
                routing="hash"
                forceRedirectUrl="/"
                appearance={clerkAppearance}
              />
            )}
          </div>

          {/* Footer toggle */}
          <div className="mx-6 py-5 border-t border-gray-100 text-center text-sm text-slate-500">
            {view === 'signin' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => setView('signup')}
                  className="text-green-600 font-semibold hover:text-green-700 hover:underline transition-colors"
                >
                  Sign up for free
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => setView('signin')}
                  className="text-green-600 font-semibold hover:text-green-700 hover:underline transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer branding below card */}
      <p className="mt-6 text-center text-xs text-slate-400">
        Secured by <span className="font-medium text-slate-500">Clerk</span>
        {' · '}
        <span className="font-medium text-slate-500">Onclusive QA Bugbot</span>
      </p>
    </div>
  );
};

export default AuthPage;
