import { createContext } from 'react';
import type { UseAztecConfig } from '../config/types';

export const UseAztecContext = createContext<UseAztecConfig | null>(null);
