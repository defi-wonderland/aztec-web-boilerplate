import React from 'react';
import { Header, StatusMessage } from './containers';
import { AztecWebInterface } from './components/contract';
import { AppProvider } from './providers';

function App() {
  return (
    <AppProvider>
      <div className="app">
        <Header />
        <StatusMessage />
        
        <main className="main-content">
          <AztecWebInterface />
        </main>
      </div>
    </AppProvider>
  );
}

export default App;
