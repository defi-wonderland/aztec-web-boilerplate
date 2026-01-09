import React from 'react';
import type { LogEntry } from './types';

const LogPanel = ({ logs }: { logs: LogEntry[] }) => {
  return (
    <div className="log-panel">
      <div className="log-header">
        <h4>Log</h4>
        <span className="log-count">{logs.length}</span>
      </div>
      <div className="log-entries">
        {logs.map((log) => (
          <div key={log.id} className={`log-entry ${log.level}`}>
            <div className="log-title">{log.title}</div>
            {log.detail && <div className="log-detail">{log.detail}</div>}
          </div>
        ))}
        {logs.length === 0 && (
          <div className="empty-state">
            No calls yet. Load an artifact to begin.
          </div>
        )}
      </div>
    </div>
  );
};

export default LogPanel;
