import React from 'react';
import { useAztecWallet } from './aztec-wallet';
import { Header, NetworkError } from './components';
import { Layout } from './containers/Layout';
import { AppProvider } from './providers';

const styles = {
  app: 'min-h-screen bg-transparent transition-[filter] duration-300',
  main: 'flex flex-col gap-6 bg-transparent',
  errorContainer: 'w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6',
} as const;

const AppContent: React.FC = () => {
  const { networkStatus, networkError, networkName, checkNetwork } =
    useAztecWallet();

  const showNetworkError = networkStatus === 'error';

  return (
    <div className={styles.app}>
      <Header />

      {showNetworkError && (
        <div className={styles.errorContainer}>
          <NetworkError
            error={networkError}
            networkName={networkName}
            onRetry={checkNetwork}
          />
        </div>
      )}

      <main className={styles.main}>
        <Layout />
      </main>
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
