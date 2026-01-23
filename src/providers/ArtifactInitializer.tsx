import React, { type ReactNode } from 'react';
import { useArtifacts, useContractSetup } from '../hooks';

interface ArtifactInitializerProps {
  children: ReactNode;
}

export const ArtifactInitializer: React.FC<ArtifactInitializerProps> = ({
  children,
}) => {
  useArtifacts();
  useContractSetup();

  return <>{children}</>;
};
