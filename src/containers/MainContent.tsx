import React from 'react';
import { FEATURE_BY_ID, FEATURES, NoFeaturesInstalled } from '../features';
import { useAppNavigation } from '../hooks';

const styles = {
  main: 'flex flex-col',
} as const;

export const MainContent: React.FC = () => {
  const { activeTab } = useAppNavigation();
  const fallbackFeature = FEATURES[0] ?? null;
  const activeFeature = activeTab ? FEATURE_BY_ID.get(activeTab) : null;
  const selectedFeature = activeFeature ?? fallbackFeature;

  if (!selectedFeature) {
    return (
      <main className={styles.main}>
        <NoFeaturesInstalled />
      </main>
    );
  }

  const ActiveFeature = selectedFeature.component;

  return (
    <main className={styles.main}>
      <ActiveFeature />
    </main>
  );
};
