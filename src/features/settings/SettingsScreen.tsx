import React from 'react';
import { SettingsCard } from './SettingsCard';

const styles = {
  wrapper: 'w-full max-w-[1400px] mx-auto px-0 lg:px-6 xl:px-10 py-0 lg:py-6',
} as const;

export const SettingsScreen: React.FC = () => {
  return (
    <div className={styles.wrapper}>
      <SettingsCard />
    </div>
  );
};
