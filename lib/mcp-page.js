/** Config for /mcp. Only capabilities that exist on the live MCP server. */

export const MCP_PROMO = {
  id: 'mcp-youtube-server',
  message: 'The Vidso MCP server can check YouTube and upload a finished video. Issue a token in Connections.',
  ctaLabel: 'Open Connections',
  ctaHref: '/connections',
  enabled: true,
}

export const MCP_HERO = {
  headingTop: 'VIDSO MCP',
  headingAccent: 'FOR ANY AI',
  subheading: 'The live server can check your YouTube connection and upload a finished video from an MCP client. Faceless videos, thumbnails, and clips still run in the Vidso app.',
}

export const MCP_CONNECT_STEPS = [
  {
    n: '1',
    title: 'Copy the Vidso connector URL',
    body: 'You will paste this URL into your MCP client. A session token from Connections authenticates it.',
    action: 'copy-url',
  },
  {
    n: '2',
    title: 'Issue a token in Connections',
    body: 'Open Connections in Vidso, issue an MCP token, and put it in your client as a Bearer header. We have not completed a live session in Claude yet, so this page does not list Claude as a supported client.',
    action: 'open-connections',
    href: '/connections',
    label: 'Open Connections',
  },
  {
    n: '3',
    title: 'Connect, then start in Vidso',
    body: 'Ask the client to call youtube_status or youtube_upload. Generation still happens in the app.',
    action: 'open-app',
    href: '/video-generation',
    label: 'Open Vidso',
  },
]

export const MCP_DEMOS = [
  {
    id: 'publishing',
    label: 'Publishing',
    prompt: 'Upload this finished MP4 to my connected YouTube channel as unlisted, using the title I already reviewed.',
    toolName: 'youtube_upload',
    chips: [
      { label: 'unlisted' },
      { label: 'title reviewed' },
    ],
    reply: 'The file is on YouTube as unlisted. Open the link in Connections to confirm.',
    resultLabel: 'Result',
    note: 'Illustrative example. Not a live call. Swap in a real upload screenshot here when you have one.',
    image: '',
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
    a: 'MCP is Model Context Protocol, a way for an AI client to call tools on a server. Vidso exposes an HTTPS JSON-RPC server at /api/mcp. You authenticate with a token issued in Connections. The live tool list is YouTube status, a connect link, and upload.',
  },
  {
    q: 'Which AI clients are supported?',
    a: 'None are listed as live-tested yet. The server handshake and tool list are covered by automated tests. We have not completed a live session in Claude, Cursor, or any other client from this environment, so this page does not name a supported client.',
  },
  {
    q: 'What can I create from Claude?',
    a: 'This page does not claim Claude support yet. From any MCP client that can call the server, you can check YouTube status and upload a finished video. Scripts, faceless videos, thumbnails, and clips are created in the Vidso app, not through these MCP tools.',
  },
  {
    q: 'Do I need an API key?',
    a: 'You need a Vidso account. Issue an MCP token in Connections and send it as a Bearer token. You do not need a separate Vidso API key.',
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
    a: 'The MCP token is a wrapped Vidso session. It can call the listed YouTube tools on your account. Revoke it in Connections to expire that token immediately. It cannot delete YouTube videos, comment, or change videos already on your channel.',
  },
]
