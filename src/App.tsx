import React, { useState, useCallback } from 'react';
import { Show } from '@clerk/react';
import Layout from './components/Layout';
import BugForm from './components/BugForm';
import BDDGenerator from './components/BDDGenerator';
import { ErrorBoundary } from './components/ErrorBoundary';
import AuthPage from './pages/AuthPage';
import { ViewState } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('bdd');

  const handleNavigate = useCallback((newView: ViewState) => {
    setView(newView);
  }, []);

  const renderContent = () => {
    switch (view) {
      case 'generator':
        return <BugForm />;
      case 'bdd':
      default:
        return <BDDGenerator />;
    }
  };

  return (
    <ErrorBoundary>
      <Show when="signed-out">
        <AuthPage />
      </Show>
      <Show when="signed-in">
        <Layout onNavigate={handleNavigate} currentView={view}>
          {renderContent()}
        </Layout>
      </Show>
    </ErrorBoundary>
  );
};

export default App;
