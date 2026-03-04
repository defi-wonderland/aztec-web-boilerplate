import type { ComponentType, ReactNode } from 'react';
import type { ContractConfigMap } from '@contract-registry';

export interface FeatureModule {
  id: string;
  label: string;
  order: number;
  icon: ReactNode | ((size: number) => ReactNode);
  component: ComponentType;
  pageVariant?: 'default' | 'page';
  contracts?: ContractConfigMap;
}
