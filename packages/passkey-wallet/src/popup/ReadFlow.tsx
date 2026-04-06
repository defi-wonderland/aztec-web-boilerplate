import type { PopupResponse, ReadSummary } from '../shared/types';

interface ReadFlowProps {
  summary: ReadSummary;
  onComplete: (response: PopupResponse) => void;
  onCancel: () => void;
}

export function ReadFlow({ summary, onComplete, onCancel }: ReadFlowProps) {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 360 }}>
      <h2>Private Data Request</h2>
      <p style={{ color: '#666', fontSize: 14 }}>
        <strong>{summary.dappOrigin}</strong> wants to read your private data:
      </p>
      <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
        <div><strong>Contract:</strong> {summary.contractAddress}</div>
        <div><strong>Method:</strong> {summary.methodName}</div>
      </div>
      <button onClick={() => onComplete({ type: 'read-approved' })}
        style={{ width: '100%', padding: '12px 24px', fontSize: 16, background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
        Allow
      </button>
      <button onClick={onCancel}
        style={{ width: '100%', padding: '8px 24px', marginTop: 8, background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}>
        Deny
      </button>
    </div>
  );
}
