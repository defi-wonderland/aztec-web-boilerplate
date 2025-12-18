import React from 'react';
import { Header, StatusMessage } from './components';
import { Layout } from './containers/Layout';
import { AppProvider } from './providers';

function App() {
  return (
    <AppProvider>
      <div className="app">
        <Header />
        <StatusMessage />

        <main className="main-content">
          <Layout />
        </main>
      </div>
    </AppProvider>
  );
}

export default App;
