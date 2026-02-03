import React, { useState } from 'react';
import { Settings, Home, Globe } from 'lucide-react';
import { FeePaymentSelector } from '../components/FeePaymentSelector';
import { ConfigDisplay } from '../components/settings';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui';
import { iconSize } from '../utils';
import type { AztecNetwork } from '../config/networks/constants';

const styles = {
  headerRow: 'flex flex-row items-start gap-3',
  headerIcon: 'text-accent',
  tabContent: 'space-y-6',
  divider: 'border-t border-default',
} as const;

export const SettingsCard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AztecNetwork>('sandbox');

  return (
    <Card>
      <CardHeader className={styles.headerRow}>
        <Settings size={iconSize('xl')} className={styles.headerIcon} />
        <div>
          <CardTitle>Network Configuration</CardTitle>
          <CardDescription>View and configure network settings</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as AztecNetwork)}
        >
          <TabsList>
            <TabsTrigger value="sandbox">
              <Home size={iconSize()} />
              Sandbox
            </TabsTrigger>
            <TabsTrigger value="devnet">
              <Globe size={iconSize()} />
              Devnet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sandbox">
            <div className={styles.tabContent}>
              <ConfigDisplay networkName="sandbox" />
              <div className={styles.divider} />
              <FeePaymentSelector networkName="sandbox" />
            </div>
          </TabsContent>
          <TabsContent value="devnet">
            <div className={styles.tabContent}>
              <ConfigDisplay networkName="devnet" />
              <div className={styles.divider} />
              <FeePaymentSelector networkName="devnet" />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
