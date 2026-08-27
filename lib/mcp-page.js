/** Config for /mcp. Only capabilities that exist on the live MCP server. */

export const MCP_PROMO = {
  id: 'mcp-youtube-server',
  message: 'Copy your Claude connector URL in Connections, then paste it in Customize → Connectors.',
  ctaLabel: 'Open Connections',
  ctaHref: '/connections',
  enabled: true,
}

export const MCP_HERO = {
  headingTop: 'CLAUDE × VIDSO',
  headingAccent: 'MCP CONNECTOR',
  subheading: 'Paste your personal connector URL into Claude. The live tools can check YouTube and upload a finished video. Faceless videos, thumbnails, and clips still run in the Vidso app.',
}

export const MCP_CONNECT_STEPS = [
  {
    n: '1',
    title: 'Copy your personal connector URL',
    body: 'Open Connections. Vidso issues a Claude connector URL for your account. That URL is the whole credential. Do not share it.',
    action: 'open-connections',
    href: '/connections',
    label: 'Open Connections',
  },
  {
    n: '2',
    title: 'Paste it in Claude Customize → Connectors',
    body: 'In Claude, open Customize, then Connectors, add a custom connector, and paste the URL. Claude does not need a separate Bearer header.',
    action: 'open-claude',
    href: 'https://claude.ai/settings/connectors',
    label: 'Open Claude connectors',
  },
  {
    n: '3',
    title: 'Ask Claude, then start in Vidso',
    body: 'Ask Claude to call youtube_status or youtube_upload. Scripts, faceless videos, thumbnails, and clips are still created in the app.',
    action: 'open-app',
    href: '/video-generation',
    label: 'Open Vidso',
  },
]

export const MCP_DEMOS = [
  {
    id: 'publishing',
    label: 'Publishing',
    windowTitle: 'Claude • Vidso connector',
    prompt: 'Upload this finished MP4 to my connected YouTube channel as unlisted, using the title I already reviewed.',
    toolName: 'youtube_upload',
    chips: [
      { label: 'unlisted' },
      { label: 'title reviewed' },
    ],
    reply: 'The file is on YouTube as unlisted. Open the link in Connections to confirm.',
    status: '1 upload • unlisted • youtube_upload',
    placeholders: 8,
    image: '',
  },
]

export const MCP_FEATURE_CARDS = [
  {
    n: '01',
    title: 'Check YouTube status',
    body: 'Ask Claude to call youtube_status and see whether a channel is connected.',
  },
  {
    n: '02',
    title: 'Get a connect link',
    body: 'If nothing is connected, youtube_connect_url returns the Google sign-in link.',
  },
  {
    n: '03',
    title: 'Upload a finished video',
    body: 'Point youtube_upload at a render job id or a public MP4 URL. Title and privacy still get reviewed in Vidso.',
  },
]

export const MCP_WORKFLOW_CATEGORIES = [
  { id: 'featured', name: 'Featured', blurb: 'What the live MCP server can run today' },
  { id: 'publishing', name: 'Publishing', blurb: 'YouTube from a finished file' },
  { id: 'utility', name: 'Utility', blurb: 'Connection checks' },
]

export const MCP_WORKFLOWS = [
  {
    id: 'upload-finished',
    categories: ['featured', 'publishing'],
    name: 'Upload a finished video',
    time: '2 min',
    tag: 'Workflow',
    image: '',
  },
  {
    id: 'check-status',
    categories: ['featured', 'utility'],
    name: 'Check YouTube status',
    time: '1 min',
    tag: 'Workflow',
    image: '',
  },
  {
    id: 'connect-channel',
    categories: ['publishing', 'utility'],
    name: 'Get a YouTube connect link',
    time: '1 min',
    tag: 'Workflow',
    image: '',
  },
]

export const MCP_FAQ = [
  {
    q: 'What is MCP and how does Vidso connect to it?',
    a: 'MCP is Model Context Protocol, a way for an AI client to call tools on a server. Vidso exposes an HTTPS JSON-RPC server at /api/mcp. Your personal connector URL from Connections authenticates it. The live tool list is YouTube status, a connect link, and upload.',
  },
  {
    q: 'Which AI clients are supported?',
    a: 'Claude is the client this connector is built for. Copy the personal URL from Connections and paste it in Claude Customize → Connectors. Cursor can use the same URL, or a JSON config with a Bearer header, also from Connections.',
  },
  {
    q: 'What can I create from Claude?',
    a: 'From Claude, you can check YouTube status and upload a finished video. Scripts, faceless videos, thumbnails, and clips are created in the Vidso app, not through these MCP tools.',
  },
  {
    q: 'Do I need an API key?',
    a: 'You need a Vidso account. Connections issues a personal connector URL. Claude uses that URL as the credential. You do not need a separate Vidso API key.',
  },
  {
    q: 'How does this affect my plan limits?',
    a: 'MCP usage consumes the same plan allowance as the app. There is no separate quota, and there is no way to bypass limits through Claude or any other client.',
  },
  {
    q: 'How long does generation take?',
    a: 'These MCP tools do not generate video. A YouTube upload depends on file size and YouTube. Faceless renders and thumbnails still run in the app and take the same time they do today.',
  },
  {
    q: 'Can I use my previous projects as input?',
    a: 'youtube_upload needs a public https URL of an MP4 the server can fetch, or a render job id. You can point it at an export you already made. The server does not browse your full project library.',
  },
  {
    q: 'Is my account safe, and what can the connection access?',
    a: 'The connector URL is a wrapped Vidso session. Anyone with that URL can call the listed YouTube tools on your account. Revoke it in Connections to expire it immediately. It cannot delete YouTube videos, comment, or change videos already on your channel.',
  },
]
