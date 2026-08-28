/** Config for /mcp. Only capabilities that exist on the live MCP server. */

export const MCP_PROMO = {
  id: 'mcp-youtube-server',
  message: 'Copy your Claude connector URL below, then paste it into Claude Customize.',
  ctaLabel: 'Copy URL',
  ctaHref: '#connect',
  enabled: true,
}

export const MCP_HERO = {
  headingTop: 'VIDSO MCP',
  headingAccent: 'FOR CLAUDE',
  subheading: 'Create videos in Vidso, then ask Claude to check YouTube or upload a finished file. The connector is a private link for your account.',
}

export const MCP_CONNECT_STEPS = [
  {
    n: '1',
    title: 'Copy your connector URL',
    body: 'This private link is the login for Claude. Copy it, then paste it when Claude asks for a connector URL. Do not share it.',
    action: 'copy-url',
    href: '',
    label: 'Copy',
  },
  {
    n: '2',
    title: 'Open Claude Customize, then Connectors',
    body: 'In Claude, go to Customize, then Connectors. Add a custom connector, name it Vidso, and paste the URL from step 1.',
    action: 'open-claude',
    href: 'https://claude.ai/settings/connectors',
    label: 'Open Claude Customize',
  },
  {
    n: '3',
    title: 'Connect, sign in, and start',
    body: 'Sign in if Claude asks. Then make the video in Faceless Studio and tell Claude to send it to YouTube.',
    action: 'open-app',
    href: '/faceless-studio',
    label: 'Start creating',
  },
]

export const MCP_DEMOS = [
  {
    id: 'publishing',
    label: 'Publishing',
    windowTitle: 'Claude • Vidso connector',
    prompt: 'Upload my finished video to YouTube as unlisted.',
    toolName: 'Upload to YouTube',
    chips: [
      { label: 'unlisted' },
      { label: 'done in one ask' },
    ],
    reply: 'Done. The video is on YouTube as unlisted. Open Connections if you want the link.',
    status: 'Uploaded • unlisted',
    placeholders: 0,
    image: '',
  },
]

export const MCP_FEATURE_CARDS = [
  {
    n: '01',
    title: 'See if YouTube is connected',
    body: 'Ask Claude: "Is my YouTube channel connected?" It will tell you yes or no.',
  },
  {
    n: '02',
    title: 'Connect YouTube if you have not yet',
    body: 'If nothing is connected, Claude will send you to the Google sign-in page.',
  },
  {
    n: '03',
    title: 'Send a finished video',
    body: 'Ask Claude to upload the video. You can still check the title in Vidso first if you want.',
  },
]

export const MCP_TOOL_COPY = {
  youtube_status: {
    title: 'Check YouTube',
    description: 'Ask Claude whether your YouTube channel is connected.',
  },
  youtube_connect_url: {
    title: 'Connect YouTube',
    description: 'If you have not connected a channel yet, Claude will point you to Google sign-in.',
  },
  youtube_upload: {
    title: 'Upload a video',
    description: 'Ask Claude to send a finished video to your connected YouTube channel.',
  },
}

export const MCP_APP_TOOLS = [
  { id: 'facelessstudio', name: 'Faceless Studio', description: 'Write, voice, B-roll, and export a long-form video.', href: '/faceless-studio' },
  { id: 'videogen', name: 'Long Form Generator', description: 'Script to a finished YouTube video.', href: '/video-generation' },
  { id: 'imagegen', name: 'Thumbnail Generator', description: 'Prompt to a YouTube thumbnail.', href: '/image-generation' },
  { id: 'tools', name: 'All tools', description: 'Clipping, captions, voiceover, and the rest.', href: '/tools' },
]

export const MCP_WORKFLOW_CATEGORIES = [
  { id: 'featured', name: 'Featured', blurb: 'What you can do today' },
  { id: 'publishing', name: 'Publishing', blurb: 'Send a finished file to YouTube' },
  { id: 'utility', name: 'Setup', blurb: 'Connect your channel' },
]

export const MCP_WORKFLOWS = [
  {
    id: 'upload-finished',
    categories: ['featured', 'publishing'],
    name: 'Upload a finished video',
    time: '2 min',
    tag: 'YouTube',
    href: '/connections',
    image: '',
  },
  {
    id: 'check-status',
    categories: ['featured', 'utility'],
    name: 'See if YouTube is connected',
    time: '1 min',
    tag: 'Setup',
    href: '/connections',
    image: '',
  },
  {
    id: 'connect-channel',
    categories: ['publishing', 'utility'],
    name: 'Connect a YouTube channel',
    time: '1 min',
    tag: 'Setup',
    href: '/connections',
    image: '',
  },
  {
    id: 'make-video',
    categories: ['featured'],
    name: 'Make the video in Faceless Studio',
    time: 'In app',
    tag: 'Vidso',
    href: '/faceless-studio',
    image: '',
  },
]

export const MCP_FAQ = [
  {
    q: 'What is this connector?',
    a: 'It is a private link that lets Claude talk to your Vidso account. Claude can check YouTube and upload a finished video. You still make the videos in Vidso.',
  },
  {
    q: 'Which AI apps work with this?',
    a: 'This connector is built for Claude. Copy the private link from Connections and paste it in Claude under Customize, then Connectors.',
  },
  {
    q: 'What can I do from Claude?',
    a: 'You can check whether YouTube is connected, get a connect link, and upload a finished video. Scripts, faceless videos, thumbnails, and clips are made in the Vidso app.',
  },
  {
    q: 'Do I need an API key?',
    a: 'You need a Vidso account. Connections gives you a private link. That link is the login. You do not need a separate API key.',
  },
  {
    q: 'How does this affect my plan limits?',
    a: 'Uploads and renders use the same plan limits as the app. There is no extra quota, and there is no way around limits through Claude.',
  },
  {
    q: 'How long does an upload take?',
    a: 'These Claude actions do not generate the video. Upload time depends on file size and YouTube. Faceless renders still run in the app.',
  },
  {
    q: 'Can I use a video I already made?',
    a: 'Yes. Point Claude at a finished MP4 link, or upload from Connections after you export in Vidso.',
  },
  {
    q: 'Is my account safe?',
    a: 'Anyone with that private link can upload to your connected YouTube channel. Do not share it. Revoke it in Connections to cut access right away. It cannot delete YouTube videos, comment, or change videos already on your channel.',
  },
]
