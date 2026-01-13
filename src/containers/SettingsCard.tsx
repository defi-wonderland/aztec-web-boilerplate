import React, { useState } from 'react';
import { Settings, Home, Globe } from 'lucide-react';
import { ConfigDisplay } from '../components/settings';
import type { AztecNetwork } from '../config/networks/constants';
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

const styles = {
  headerRow: 'flex flex-row items-start gap-3',
  headerIcon: 'h-8 w-8 text-accent',
  tabIcon: 'h-4 w-4',
} as const;

export const SettingsCard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AztecNetwork>('sandbox');

  return (
    <Card>
      <CardHeader className={styles.headerRow}>
        <Settings className={styles.headerIcon} />
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
              <Home className={styles.tabIcon} />
              Sandbox
            </TabsTrigger>
            <TabsTrigger value="devnet">
              <Globe className={styles.tabIcon} />
              Devnet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sandbox">
            <ConfigDisplay networkName="sandbox" />
          </TabsContent>
          <TabsContent value="devnet">
            <ConfigDisplay networkName="devnet" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
