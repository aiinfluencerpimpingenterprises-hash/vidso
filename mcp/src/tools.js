import { z } from 'zod';
import { api, pollUntil, getVidsoToken, VidsoApiError } from './vidso-api.js';
import { DASHBOARD_URL } from './config.js';

function textResult(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: 'text', text }] };
}

function errResult(err) {
  const payload = {
    error: err.message,
    status: err.status,
    code: err.code,
    needs_plan: Boolean(err.needsPlan),
    hint: err.needsPlan
      ? 'This action requires an active Vidso plan or remaining credits. Upgrade at https://www.vidso.pro/home#pricing'
      : undefined,
  };
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: true };
}

const durationId = z
  .enum(['1min', '2min', '3min', '5min', '8min', '10min'])
  .default('2min')
  .describe('Target duration preset id used by Vidso script generation');

const aspect = z.enum(['16:9', '9:16', '1:1']).default('16:9').describe('Output aspect ratio');

export function registerTools(server) {
  server.registerTool(
    'whoami',
    {
      title: 'Who am I',
      description: 'Return the authenticated Vidso user profile and remaining credits/quota.',
      inputSchema: {},
    },
    async () => {
      try {
        const me = await api.me();
        return textResult({
          ...me,
          dashboard: DASHBOARD_URL,
        });
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    'list_voices',
    {
      title: 'List voices',
      description: 'List available narrator voices for Vidso TTS / long-form voiceover.',
      inputSchema: {},
    },
    async () => {
      try {
        const voices = await api.voices();
        const list = Array.isArray(voices) ? voices : voices.voices || [];
        return textResult({
          count: list.length,
          voices: list.map((v) => ({
            id: v.id,
            name: v.name,
            category: v.category,
            preview_url: v.preview_url,
          })),
        });
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    'list_presets',
    {
      title: 'List presets',
      description: 'List Vidso faceless duration / style presets available for script generation.',
      inputSchema: {},
    },
    async () => {
      try {
        return textResult(await api.presets());
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    'create_script',
    {
      title: 'Create script',
      description: 'Generate a long-form video script from a topic (Vidso faceless script API).',
      inputSchema: {
        topic: z.string().min(3).describe('Video topic / idea'),
        duration_id: durationId,
        aspect,
      },
    },
    async ({ topic, duration_id, aspect: aspectRatio }) => {
      try {
        const script = await api.createScript({ topic, duration_id, aspect: aspectRatio });
        return textResult(script);
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    'search_broll',
    {
      title: 'Search B-roll',
      description: 'Search stock B-roll clips for a query (Vidso Pexels-backed search).',
      inputSchema: {
        query: z.string().min(2).describe('Search query'),
        aspect,
        per_page: z.number().int().min(1).max(40).optional().describe('Optional result count'),
      },
    },
    async ({ query, aspect: aspectRatio, per_page }) => {
      try {
        const body = { query, aspect: aspectRatio };
        if (per_page) body.per_page = per_page;
        return textResult(await api.searchBroll(body));
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    'start_media',
    {
      title: 'Start media assembly',
      description:
        'Start voiceover + B-roll assembly for a script. Returns a media jobId. Poll with get_job_status (kind=media).',
      inputSchema: {
        script: z
          .any()
          .describe('Script object from create_script (title, sections, full_script, etc.)'),
        voice_id: z.string().min(3).describe('Narrator voice id from list_voices'),
        aspect,
      },
    },
    async ({ script, voice_id, aspect: aspectRatio }) => {
      try {
        const started = await api.startMedia({ script, voice_id, aspect: aspectRatio });
        return textResult({
          ...started,
          kind: 'media',
          next: 'Call get_job_status with kind=media and this jobId, or use generate_video for the full pipeline.',
        });
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    'render_video',
    {
      title: 'Render video',
      description:
        'Start final MP4 render from media assembly outputs (voiceover_url, words, timeline). Poll with get_job_status (kind=render).',
      inputSchema: {
        voiceover_url: z.string().url(),
        duration: z.number().positive(),
        words: z.array(z.any()),
        timeline: z.array(z.any()),
        aspect,
        caption_style: z.string().default('karaoke').describe('Caption style preset'),
        music_enabled: z.boolean().default(false),
      },
    },
    async (args) => {
      try {
        const started = await api.startRender({
          voiceover_url: args.voiceover_url,
          duration: args.duration,
          words: args.words,
          timeline: args.timeline,
          aspect: args.aspect,
          caption: { enabled: true, style: args.caption_style || 'karaoke' },
          music: { enabled: Boolean(args.music_enabled) },
        });
        return textResult({
          ...started,
          kind: 'render',
          next: 'Call get_job_status with kind=render and this jobId.',
        });
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    'get_job_status',
    {
      title: 'Get job status',
      description: 'Check media or render job progress by job id.',
      inputSchema: {
        kind: z.enum(['media', 'render']).describe('Which pipeline stage to poll'),
        job_id: z.string().min(4).describe('Job id returned by start_media or render_video'),
        wait: z
          .boolean()
          .default(false)
          .describe('If true, poll until done/ready (or timeout ~4.5 minutes)'),
      },
    },
    async ({ kind, job_id, wait }) => {
      try {
        if (wait) {
          const data = await pollUntil(kind, job_id);
          if (kind === 'render') {
            return textResult({
              ...data,
              download_url: api.downloadUrl(job_id),
              open_in_vidso: DASHBOARD_URL,
            });
          }
          return textResult(data);
        }
        const data = kind === 'media' ? await api.pollMedia(job_id) : await api.pollRender(job_id);
        if (kind === 'render' && ['done', 'ready', 'complete', 'completed'].includes(String(data.status))) {
          return textResult({
            ...data,
            download_url: api.downloadUrl(job_id),
            open_in_vidso: DASHBOARD_URL,
          });
        }
        return textResult(data);
      } catch (err) {
        return errResult(err);
      }
    },
  );

  server.registerTool(
    'generate_video',
    {
      title: 'Generate video',
      description:
        'Run the full Vidso long-form pipeline: script → voiceover/B-roll assembly → captions/render → MP4. May take several minutes.',
      inputSchema: {
        topic: z.string().min(3).describe('Video topic'),
        duration_id: durationId,
        aspect,
        voice_id: z
          .string()
          .optional()
          .describe('Optional voice id from list_voices; defaults to the first available voice'),
        caption_style: z.string().default('karaoke'),
        wait: z
          .boolean()
          .default(true)
          .describe('If true (default), wait for the finished MP4. If false, return early job ids.'),
      },
    },
    async ({ topic, duration_id, aspect: aspectRatio, voice_id, caption_style, wait }) => {
      try {
        const script = await api.createScript({ topic, duration_id, aspect: aspectRatio });

        let voice = voice_id;
        if (!voice) {
          const voices = await api.voices();
          const list = Array.isArray(voices) ? voices : voices.voices || [];
          if (!list.length) throw new VidsoApiError('No voices available', { status: 500 });
          voice = list[0].id;
        }

        const mediaStart = await api.startMedia({ script, voice_id: voice, aspect: aspectRatio });
        if (!wait) {
          return textResult({
            stage: 'media_queued',
            script_title: script.title,
            media_job_id: mediaStart.jobId,
            voice_id: voice,
            next: 'Poll get_job_status kind=media, then render_video, then get_job_status kind=render.',
          });
        }

        const media = await pollUntil('media', mediaStart.jobId);
        const renderStart = await api.startRender({
          voiceover_url: media.voiceover_url,
          duration: media.duration,
          words: media.words,
          timeline: media.timeline,
          aspect: media.aspect || aspectRatio,
          caption: { enabled: true, style: caption_style || 'karaoke' },
          music: { enabled: false },
        });
        const render = await pollUntil('render', renderStart.jobId);
        const token = getVidsoToken();

        return textResult({
          title: script.title,
          topic,
          duration_sec: media.duration,
          aspect: media.aspect || aspectRatio,
          voice_id: voice,
          media_job_id: mediaStart.jobId,
          render_job_id: renderStart.jobId,
          status: render.status,
          download_url: api.downloadUrl(renderStart.jobId, token),
          open_in_vidso: DASHBOARD_URL,
          warning: media.warning || undefined,
        });
      } catch (err) {
        return errResult(err);
      }
    },
  );
}
