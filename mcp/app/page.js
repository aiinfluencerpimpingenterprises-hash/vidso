export const metadata = {
  title: 'Vidso MCP',
  description: 'Vidso remote MCP connector for Claude and Cursor',
};

export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui', background: '#0B0B0C', color: '#F5F5F4', minHeight: '100vh', padding: 48 }}>
      <h1 style={{ marginTop: 0 }}>Vidso MCP</h1>
      <p style={{ color: 'rgba(245,245,244,.7)', maxWidth: 560, lineHeight: 1.5 }}>
        Remote MCP connector for Claude Desktop, claude.ai, and Cursor. Point your connector at{' '}
        <code>/mcp</code>. Setup docs: <a href="https://www.vidso.pro/docs/mcp" style={{ color: '#F5A0A8' }}>vidso.pro/docs/mcp</a>.
      </p>
      <p>
        <a href="/health" style={{ color: '#F5A0A8' }}>
          /health
        </a>
      </p>
    </main>
  );
}
