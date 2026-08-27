/** Config for /youtube. Only flows that exist in the app today. */

export const YT_PROMO = {
  id: 'yt-connect-review',
  message: 'Connect a channel, then review title and privacy before every publish.',
  ctaLabel: 'Open Connections',
  ctaHref: '/connections',
  enabled: true,
}

export const YT_HERO = {
  headingTop: 'PUBLISH TO YOUTUBE',
  headingAccent: 'WITHOUT LEAVING VIDSO',
  subheading: 'Connect your channel once, then render, title, and publish in one flow. You review metadata before anything goes out.',
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
    title: 'Pick a finished render',
    body: 'Export a video in Long Form Generator or Faceless Studio. Publishing starts from that file.',
    action: 'open-app',
    href: '/video-generation',
    label: 'Open the app',
  },
  {
    n: '3',
    title: 'Publish with metadata you review first',
    body: 'Edit the title, description, and privacy, then confirm. Vidso does not publish until you confirm.',
    action: 'open-connections',
    href: '/connections',
    label: 'Open Connections',
  },
]

export const YT_DEMOS = [
  {
    id: 'uploads',
    label: 'Uploads',
    prompt: 'Publish this finished render to my channel after I confirm the title.',
    toolName: 'YouTube upload',
    chips: [
      { label: 'unlisted' },
      { label: 'review first' },
    ],
    reply: 'Uploaded. The link is in Connections under upload history.',
    resultLabel: 'Result',
    note: 'Illustrative example. Not a live call. Add a real published frame here when you have one.',
    image: '',
  },
  {
    id: 'metadata',
    label: 'Metadata',
    prompt: 'Draft a title and description from this script, then wait for me to confirm before publishing.',
    toolName: 'Publish review',
    chips: [
      { label: 'title' },
      { label: 'description' },
      { label: 'privacy' },
    ],
    reply: 'Nothing is public until you confirm the form. Vidso does not review or auto-publish for you.',
    resultLabel: 'Result',
    note: 'Illustrative example. The live review form is in the app.',
    image: '',
  },
]

export const YT_FEATURES = [
  {
    title: 'Uploads from a finished project',
    body: 'After a render finishes, publish that file to the connected channel.',
  },
  {
    title: 'Title and description you review',
    body: 'We draft from the script. You edit title, description, and privacy, then confirm. Vidso never publishes without that confirmation.',
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
    a: 'YouTube gives this Google Cloud project a shared daily quota of 10,000 units. Each upload costs 1,600 units, so the whole Vidso platform can publish about 6 videos per day, not 6 per account. The window resets at midnight Pacific Time. If the bucket is full, the upload is saved as queued and is not dropped. Retry it from Connections after the reset. We cannot read Google’s live remaining quota in the app, so Connections shows this cap and how many of your uploads landed today.',
  },
  {
    q: 'Why does my upload say queued?',
    a: 'The shared daily bucket is full, or YouTube returned a quota error. The row stays in history. It will go out when you retry after midnight Pacific Time, when Google resets quota.',
  },
  {
    q: 'Do you review my metadata before publishing?',
    a: 'No. You review it. We draft a title and description from the script, then wait for your confirmation. We never auto-publish without that step.',
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
    a: 'This Google OAuth client is not published for all accounts yet. You may see an unverified-app warning, and only Google accounts added as test users can connect until verification is complete. That is a Google review of this OAuth app, not a Vidso plan limit.',
  },
  {
    q: 'Can I connect more than one channel?',
    a: 'Not yet. One YouTube channel per Vidso account. This page does not claim multiple channels or scheduled publishing, because those are not built.',
  },
]
