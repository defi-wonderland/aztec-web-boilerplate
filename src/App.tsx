import React from 'react';
import { Header } from './components';
import { Layout } from './containers/Layout';
import { AppProvider } from './providers';

const styles = {
  app: 'min-h-screen bg-transparent transition-[filter] duration-300',
  main: 'flex flex-col gap-6 bg-transparent',
} as const;

function App() {
  return (
    <AppProvider>
      <div className={styles.app}>
        <Header />

        <main className={styles.main}>
          <Layout />
        </main>
      </div>
    </AppProvider>
  );
}

export default App;
