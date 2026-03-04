import React from 'react';
import { Settings } from 'lucide-react';
import { iconSize } from '../../utils';
import { SettingsScreen } from './SettingsScreen';
import type { FeatureModule } from '../types';

const feature: FeatureModule = {
  id: 'settings',
  label: 'Settings',
  order: 300,
  icon: (size) => <Settings size={size || iconSize()} />,
  component: SettingsScreen,
  pageVariant: 'page',
};

export default feature;
