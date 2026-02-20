import React from 'react';
import { MainContent } from './MainContent';

const styles = {
  container: 'w-full',
} as const;

export const Layout: React.FC = () => {
  return (
    <div className={styles.container}>
      <MainContent />
    </div>
  );
};
