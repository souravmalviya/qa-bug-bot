
import React, { useState, useCallback } from 'react';
import Layout from './components/Layout';
import BugForm from './components/BugForm';
import BDDGenerator from './components/BDDGenerator';
import { ErrorBoundary } from './components/ErrorBoundary';
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
        return <BDDGenerator />;
      default:
        return <BDDGenerator />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout onNavigate={handleNavigate} currentView={view}>
        {renderContent()}
      </Layout>
    </ErrorBoundary>
  );
};

export default App;
