import React from 'react';

export default function App() {
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-app-url';

  return (
    <div style={{ padding: '50px', backgroundColor: '#0b0e14', color: '#e5e7eb', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Steam MCP Server</h1>
        <p style={{ fontSize: '1.1rem', color: '#9ca3af', marginBottom: '40px' }}>
          Your MCP server is running! If you are connecting it via an AI tool that requires OAuth (like GPT Actions or Grok), use the following mocked details to bypass authentication:
        </p>

        <div style={{ backgroundColor: '#1f2937', padding: '24px', borderRadius: '8px', border: '1px solid #374151' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', borderBottom: '1px solid #374151', paddingBottom: '10px' }}>OAuth Connection Details</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Client ID</div>
              <div style={{ padding: '8px 12px', backgroundColor: '#111827', borderRadius: '4px', border: '1px solid #374151', color: '#60a5fa', fontFamily: 'monospace' }}>mock-client-id</div>
            </div>
            
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Client Secret</div>
              <div style={{ padding: '8px 12px', backgroundColor: '#111827', borderRadius: '4px', border: '1px solid #374151', color: '#60a5fa', fontFamily: 'monospace' }}>mock-client-secret</div>
            </div>

            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Authorization Endpoint</div>
              <div style={{ padding: '8px 12px', backgroundColor: '#111827', borderRadius: '4px', border: '1px solid #374151', color: '#34d399', fontFamily: 'monospace' }}>{currentUrl}/oauth/authorize</div>
            </div>

            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Token Endpoint</div>
              <div style={{ padding: '8px 12px', backgroundColor: '#111827', borderRadius: '4px', border: '1px solid #374151', color: '#34d399', fontFamily: 'monospace' }}>{currentUrl}/oauth/token</div>
            </div>

            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Scopes</div>
              <div style={{ padding: '8px 12px', backgroundColor: '#111827', borderRadius: '4px', border: '1px solid #374151', color: '#c084fc', fontFamily: 'monospace' }}>read</div>
            </div>

            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Token Auth Method</div>
              <div style={{ padding: '8px 12px', backgroundColor: '#111827', borderRadius: '4px', border: '1px solid #374151', color: '#c084fc', fontFamily: 'monospace' }}>client_secret_post <span style={{ color: '#9ca3af', fontSize: '0.8rem', marginLeft: '8px' }}>(or basic)</span></div>
            </div>
          </div>
          <p style={{ marginTop: '20px', fontSize: '0.9rem', color: '#fcd34d' }}>
            Note: These values are mocked so you don't need a real API key. The server uses your public profile Steam ID provided in the environment variables instead.
          </p>
        </div>

        <div style={{ marginTop: '40px', backgroundColor: '#1f2937', padding: '24px', borderRadius: '8px', border: '1px solid #374151' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', borderBottom: '1px solid #374151', paddingBottom: '10px' }}>SSE Direct Connection Details</h2>
          <p style={{ marginBottom: '16px', color: '#9ca3af' }}>If you are connecting via Claude Desktop or Cursor, use the following server endpoint:</p>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>SSE Endpoint</div>
            <div style={{ padding: '8px 12px', backgroundColor: '#111827', borderRadius: '4px', border: '1px solid #374151', color: '#34d399', fontFamily: 'monospace' }}>{currentUrl}/mcp/sse</div>
          </div>
        </div>
      </div>
    </div>
  );
}
