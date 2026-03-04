import React from 'react';
import { UIComponentsShowcase } from './UIComponentsShowcase';

const styles = {
  wrapper:
    'w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6',
} as const;

export const UiShowcaseFeatureScreen: React.FC = () => {
  return (
    <div className={styles.wrapper}>
      <UIComponentsShowcase />
    </div>
  );
};
