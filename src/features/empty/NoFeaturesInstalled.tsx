import React from 'react';
import { PlugZap } from 'lucide-react';
import { iconSize } from '../../utils';

const styles = {
  wrapper:
    'w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center text-center gap-4',
  icon: 'w-14 h-14 rounded-xl bg-surface-secondary text-muted flex items-center justify-center',
  title: 'text-xl font-semibold text-default',
  description: 'text-sm text-muted max-w-xl',
} as const;

export const NoFeaturesInstalled: React.FC = () => {
  return (
    <section className={styles.wrapper}>
      <div className={styles.icon}>
        <PlugZap size={iconSize('2xl')} />
      </div>
      <h1 className={styles.title}>No features installed</h1>
      <p className={styles.description}>
        Add a feature folder with a <code>feature.tsx</code> file under{' '}
        <code>src/features</code> to render tabs and screens.
      </p>
    </section>
  );
};
