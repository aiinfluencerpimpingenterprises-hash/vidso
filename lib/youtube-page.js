/** Config for /youtube. Only flows that exist in the app today. */

export const YT_PROMO = {
  id: 'yt-connect-review',
  message: 'Connect a channel once. After that, uploads can be fully automated.',
  ctaLabel: 'Open Connections',
  ctaHref: '/connections',
  enabled: true,
}

export const YT_HERO = {
  headingTop: 'YOUTUBE × VIDSO',
  headingAccent: 'FULLY AUTOMATED UPLOADS',
  subheading: 'Connect your channel once. After that, uploads can be fully automated. Render in Vidso, then publish from the app or ask Claude to send it.',
}

export const YT_CONNECT_STEPS = [
  {
    n: '1',
    title: 'Connect your channel with Google',
    body: 'Sign in with the Google account that owns the channel. Vidso requests upload and read access only.',
    action: 'open-connections',
    href: '/connections',
    label: 'Connect YouTube',
  },
  {
    n: '2',
    title: 'Make the video in Vidso',
    body: 'Finish a video in Faceless Studio or Long Form Generator. Publishing starts from that file.',
    action: 'open-app',
    href: '/faceless-studio',
    label: 'Open Faceless Studio',
  },
  {
    n: '3',
    title: 'Turn on automatic uploads',
    body: 'In account settings, turn on auto-upload so finished videos go to YouTube on their own. You can still review a title first if you want.',
    action: 'open-connections',
    href: '/connections',
    label: 'Open Connections',
  },
]

export const YT_DEMOS = [
  {
    id: 'uploads',
    label: 'Uploads',
    prompt: 'Publish this finished render to my channel.',
    toolName: 'YouTube upload',
    chips: [
      { label: 'unlisted' },
      { label: 'fully automated' },
    ],
    reply: 'Uploaded. The link is in Connections under upload history.',
    resultLabel: 'Result',
    note: '',
    image: '',
  },
  {
    id: 'metadata',
    label: 'Metadata',
    prompt: 'Draft a title and description from this script, then publish.',
    toolName: 'Title and privacy',
    chips: [
      { label: 'title' },
      { label: 'description' },
      { label: 'privacy' },
    ],
    reply: 'Vidso can publish automatically once auto-upload is on. You can still open the review form if you want to edit the title first.',
    resultLabel: 'Result',
    note: '',
    image: '',
  },
]

export const YT_FEATURES = [
  {
    title: 'Fully automated uploads',
    body: 'Connect once, turn on auto-upload, and finished videos can go to YouTube without a manual upload step. Claude can send them too.',
  },
  {
    title: 'Uploads from a finished project',
    body: 'After a render finishes, publish that file to the connected channel from Vidso or from Claude.',
  },
  {
    title: 'Title and description when you want them',
    body: 'We draft from the script. Review title, description, and privacy first, or let auto-upload send it.',
  },
  {
    title: 'Privacy control',
    body: 'Public, unlisted, or private. Default for new connections is unlisted.',
  },
  {
    title: 'Upload history with retry',
    body: 'Each attempt is stored with project, channel, status, and URL. Failed or queued items can be retried from Connections.',
  },
]

export const YT_FAQ = [
  {
    q: 'How many videos can I upload per day?',
    a: 'YouTube gives this Google Cloud project a shared daily quota of 10,000 units. Each upload costs 1,600 units, so the whole Vidso platform can publish about 6 videos per day, not 6 per account. The window resets at midnight Pacific Time. If the bucket is full, the upload is saved as queued and is not dropped. Retry it from Connections after the reset.',
  },
  {
    q: 'Can uploads be fully automated?',
    a: 'Yes. Connect your channel, turn on auto-upload in account settings, and finished videos can go out on their own. You can also ask Claude to upload. If you want to check the title first, keep the review step on.',
  },
  {
    q: 'Why does my upload say queued?',
    a: 'The shared daily bucket is full, or YouTube returned a quota error. The row stays in history. It will go out when you retry after midnight Pacific Time, when Google resets quota.',
  },
  {
    q: 'Do I have to review metadata before publishing?',
    a: 'Only if you want to. We draft a title and description from the script. Auto-upload can publish without that extra click. The review form is still there if you want it.',
  },
  {
    q: 'What access does connecting my channel give Vidso?',
    a: 'Upload and read only. We never delete videos, never comment, and never edit videos that are already on your channel. Disconnect from Connections revokes the Google token immediately.',
  },
  {
    q: 'How do I disconnect?',
    a: 'Open Connections and disconnect the channel. That deletes the stored refresh token and revokes it with Google.',
  },
  {
    q: 'Google says this app is unverified. What does that mean?',
    a: 'This Google sign-in screen is not published for all accounts yet. You may see an unverified-app warning, and only Google accounts added as test users can connect until that review is complete. That is a Google review of this sign-in app, not a Vidso plan limit.',
  },
  {
    q: 'Can I connect more than one channel?',
    a: 'Not yet. One YouTube channel per Vidso account. This page does not claim multiple channels or scheduled publishing, because those are not built.',
  },
]
