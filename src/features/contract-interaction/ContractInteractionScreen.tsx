import React from 'react';
import { ContractLayout } from './components';

const styles = {
  wrapper: 'w-full',
} as const;

export const ContractInteractionScreen: React.FC = () => {
  return (
    <div className={styles.wrapper}>
      <ContractLayout />
    </div>
  );
};
