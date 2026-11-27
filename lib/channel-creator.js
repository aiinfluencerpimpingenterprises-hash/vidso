/**
 * Channel creator: the first-run flow, laid out like Higgsfield's Faceless
 * Studio. A full-bleed hero ("Channel about…"), then a channel page
 * with an AI name and first-episode topics, then style and narrator, with a
 * step rail on the right. The Manager guides every screen.
 *
 * Finishing saves a brand profile through the Agents app and can start the
 * first episode right away. Used after signup, by Brand > New profile and by
 * "Set up my channel" in the chat.
 */

import { agentSvg, lengthOptions } from './agents-chat.js'
import { VISUAL_STYLES, STYLE_GROUPS, VISUAL_MODES, SCENE_PACES, visualStyleById, styleSample } from './visual-styles.js'
import { GENRES, genreById, fallbackChannel } from './onboarding.js'
import { rankedNiches, nicheById, customNiche } from './niches.js'
import { normalizeProfile, ANGLES, scriptEstimate, nearestDuration } from './channel-kit.js'
import { voiceGroupFor, voiceGroup, rankVoices, bestForIds, captionLookFor } from './genre-kit.js'

/** Which genre (art styles, captions, angle) suits each kind of channel from genre-kit. */
const GROUP_GENRE = { mystery: 'mystery', history: 'history', education: 'education', story: 'storytelling', kids: 'kids', psychology: 'education', finance: 'documentary' }
/** True when the channel's words say what kind of channel it is (not just the default). */
const topicGroupKnown = (c) => voiceGroupFor({ genre: 'kids', niche: c.nicheId, about: c.about }) === voiceGroupFor({ genre: '', niche: c.nicheId, about: c.about })

export const CREATOR_STEPS = [
  { id: 'topic', name: 'Select topic', say: 'I named your channel. Rename it if you like, then pick the first episode.' },
  { id: 'style', name: 'Select video style', say: 'Every scene is drawn in one style. The first few suit your channel best, and the rest are all here too.' },
  { id: 'voice', name: 'Select narrator', say: 'Press play to hear a voice. This narrator reads every video.' },
  { id: 'captions', name: 'Select captions', say: 'This is how the words look on screen. The Editor burns them in exactly like this.' },
]

/** The plan's longest video in seconds (Infinity when there is no cap). */
const lenCap = () => { try { const c = Number(window.fvDurationCap?.()); return Number.isFinite(c) && c > 0 ? c : Infinity } catch (_) { return Infinity } }

/** A stable hue for a voice avatar, from its name. */
export function hueFor(name = '') {
  let h = 0
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

const CSS = `
.cc{--cc-ink:#f4f4f2;--cc-mute:rgba(244,244,242,.6);--cc-line:rgba(255,255,255,.1);position:relative;color:var(--cc-ink);font-family:Inter,system-ui,-apple-system,sans-serif;min-height:calc(100dvh - 72px)}
/* Same heading face as the landing page (home/index.html): Lora, regular, warm white. */
.cc-display{font-family:Lora,Georgia,'Times New Roman',serif;font-weight:400;letter-spacing:-.025em;line-height:1.04;color:#f6f3ee}
.cc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 20px;border-radius:999px;border:0;background:#262628;color:var(--cc-ink);font:inherit;font-size:.9rem;font-weight:500;cursor:pointer;white-space:nowrap}
.cc-btn:hover{background:#303033}
.cc-btn.is-primary{background:#fff;color:#111;border-color:#fff}
.cc-btn.is-primary:hover{background:#ececec}
.cc-btn:disabled{opacity:.4;cursor:not-allowed}
.cc-btn:focus-visible,.cc-topic:focus-visible,.cc-style:focus-visible,.cc-voice:focus-visible,.cc-chip:focus-visible{outline:2px solid #fff;outline-offset:2px}
.cc-manager{display:flex;align-items:flex-start;gap:10px;text-align:left}
.cc-manager .ag-blob{width:40px;height:40px;flex:0 0 40px}
.cc-manager p{margin:0;padding:10px 14px;border-radius:6px 16px 16px 16px;background:rgba(20,20,22,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid var(--cc-line);font-size:.92rem;line-height:1.45}
.cc-manager b{display:block;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--cc-mute);margin-bottom:2px}
/* hero: plain background, medium-weight title with a white Manager in it, lots of air (like Grok Bot) */
.cc-hero{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:26px;padding:84px 20px 64px;text-align:center}
/* Start screen = the landing hero: genre scene behind, four video tiles over the prompt box. */
.cc-banner.is-hero{height:calc(100dvh + var(--app-chrome-h, 0px));-webkit-mask-image:linear-gradient(#000 70%,transparent);mask-image:linear-gradient(#000 70%,transparent)}
.cc-banner.is-hero::after{background:radial-gradient(ellipse 48% 42% at 50% 46%,rgba(0,0,0,.72),transparent 100%)}
.cc-hero:has(.cc-cats){min-height:calc(100dvh - var(--app-chrome-h, 64px) - 90px);justify-content:center;padding-top:40px;padding-bottom:40px}
.cc-hero:has(.cc-cats) h1{max-width:11.5em;font-size:clamp(2.8rem,6.2vw,5.6rem);line-height:1.04}
.cc-cats{display:flex;align-items:flex-end;justify-content:center;gap:8px;width:min(720px,100%);margin:14px auto -16px}
.cc-cat{position:relative;flex:1 1 0;min-width:0;height:58px;display:flex;align-items:flex-end;padding:0;overflow:hidden;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:#141416;cursor:pointer;transition:height .3s cubic-bezier(.2,.8,.2,1),flex-grow .3s cubic-bezier(.2,.8,.2,1),border-color .2s}
.cc-cat video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
.cc-cat::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.45),transparent 60%);pointer-events:none}
.cc-cat span{position:relative;z-index:1;margin:6px;padding:3px 9px;border-radius:999px;background:rgba(0,0,0,.55);color:rgba(255,255,255,.85);font-size:11.5px;font-weight:500}
.cc-cat:hover{border-color:rgba(255,255,255,.28)}
.cc-cat.is-on{height:68px;flex-grow:1.22;border:2px solid #fff;box-shadow:0 0 0 4px rgba(255,255,255,.12)}
.cc-cat.is-on span{background:#fff;color:#111}
.cc-pill{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 5px 0 6px;border-radius:999px;background:#18181a;font-size:.86rem;color:rgba(255,255,255,.72);white-space:nowrap}
.cc-pill b{color:#fff;font-weight:500}
.cc-pill .ag-blob{width:24px;height:24px;flex:0 0 24px}
.cc-pill i{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#262628;font-style:normal;font-size:.72rem;color:#fff}
.cc-hero h1{margin:4px 0 0;font-size:clamp(2.6rem,5.4vw,4.6rem);display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:.22em;color:#f6f3ee;text-wrap:balance}
.cc-hero h1 .ag-blob{width:.95em;height:.95em;flex:0 0 .95em}
.cc-lead{margin:-8px 0 8px;max-width:620px;font-size:clamp(1rem,1.5vw,1.18rem);line-height:1.6;color:rgba(255,255,255,.5);font-weight:400}
.cc-hero .hero-pin{position:absolute;z-index:1;display:inline-flex;align-items:flex-end;gap:2px;color:#fff;line-height:1;pointer-events:none}
.cc-hero .hero-pin .blob{width:40px;height:40px;display:block;overflow:visible;filter:drop-shadow(0 8px 14px rgba(0,0,0,.4));animation:ccBlobBob 3.2s ease-in-out infinite}
.cc-hero .hero-pin .blob .body{fill:var(--pin);stroke:var(--pin)}
.cc-hero .hero-pin .blob .eyes{fill:#141414;transform-box:fill-box;transform-origin:center;animation:ccBlobBlink 4.6s infinite}
.cc-hero .hero-pin b{margin:0 0 -2px;padding:3px 7px;border-radius:999px;background:var(--pin);font-size:11.5px;font-weight:550;letter-spacing:-.01em;box-shadow:0 6px 14px rgba(0,0,0,.3)}
.cc-hero .hero-pin.pin-script .blob,.cc-hero .hero-pin.pin-script .eyes{animation-delay:-1.1s}
.cc-hero .hero-pin.pin-voice .blob,.cc-hero .hero-pin.pin-voice .eyes{animation-delay:-2.3s}
.cc-hero .hero-pin.pin-agent .blob,.cc-hero .hero-pin.pin-agent .eyes{animation-delay:-3.4s}
@keyframes ccBlobBob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-4px) rotate(-4deg)}}
@keyframes ccBlobBlink{0%,90%,100%{transform:scaleY(1)}94%{transform:scaleY(.12)}}
.cc-hero .hero-pin.pin-you{top:18%;left:7%;--pin:#ff2d48}
.cc-hero .hero-pin.pin-script{top:16%;right:8%;--pin:#22b864}
.cc-hero .hero-pin.pin-voice{top:58%;left:6%;--pin:#ff6a4d}
.cc-hero .hero-pin.pin-agent{top:58%;right:6%;--pin:#ff4fa3}
@media (max-width:800px){.cc-hero .hero-pin{display:none}}
@media (prefers-reduced-motion:reduce){.cc-hero .hero-pin .blob,.cc-hero .hero-pin .blob .eyes{animation:none}}
.cc-box{display:flex;align-items:flex-end;gap:12px;width:min(720px,100%);padding:12px 12px 12px 20px;border-radius:30px;background:#18181a;border:1px solid rgba(255,255,255,.06);text-align:left}
.cc-box-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px}
.cc-box textarea{width:100%;box-sizing:border-box;min-height:52px;background:transparent;border:0;color:var(--cc-ink);font:inherit;font-size:1.05rem;line-height:1.45;resize:none;padding:6px 8px}
#panel-create .cc textarea:focus,#panel-create .cc input:focus{outline:none!important;box-shadow:none!important}
.cc-box:focus-within{border-color:rgba(255,255,255,.18)}
.cc-tools{display:flex;gap:6px;padding:0 4px}
.cc-tools .cc-chip svg{flex:0 0 auto}
.cc-ref-row{display:flex;gap:6px;align-items:center;padding:0 4px}
.cc-ref-row input{flex:1;min-width:0;height:36px;box-sizing:border-box;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:#111113;color:var(--cc-ink);font:inherit;font-size:.88rem}
.cc-ref-row .cc-chip{height:36px}
.cc-refcard{display:flex;flex-direction:column;align-items:center;gap:6px;max-width:720px;margin-top:-6px}
.cc-refcard .cc-manager p{background:#18181a;backdrop-filter:none}
.cc-trend{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 16px;max-width:760px;line-height:1.5;margin-top:-8px;font-size:.84rem;color:rgba(255,255,255,.4)}
.cc-trend button{background:none;border:0;padding:0;color:rgba(255,255,255,.62);font:inherit;cursor:pointer}
.cc-trend button:hover,.cc-trend button.is-on{color:#fff}
.cc-trend button:focus-visible{outline:2px solid #fff;outline-offset:2px;border-radius:4px}
.cc-next{flex:0 0 auto;height:48px;padding:0 22px;border-radius:999px;border:0;background:#fff;color:#111;font:inherit;font-size:1rem;font-weight:500;cursor:pointer;white-space:nowrap}
.cc-next:disabled{background:#fff;color:#111;opacity:.4;cursor:not-allowed}
.cc-next:focus-visible{outline:2px solid #fff;outline-offset:3px}
.cc-chips{display:flex;gap:6px;flex-wrap:wrap}
.cc-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--cc-line);background:rgba(255,255,255,.05);color:var(--cc-ink);font:inherit;font-size:.78rem;cursor:pointer}
.cc-chip:hover{background:rgba(255,255,255,.1)}
.cc-chip.is-on{background:#fff;color:#111;border-color:#fff}
.cc-chip.is-locked{opacity:.55;border-style:dashed}
.cc-chip em{font-style:normal;opacity:.55}
.cc-skip{background:none;border:0;color:rgba(255,255,255,.45);font:inherit;font-size:.84rem;cursor:pointer}
.cc-skip:hover{color:#fff}
/* steps */
.cc-page{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:28px;max-width:1240px;margin:0 auto;padding:10px 6px 40px}
.cc-crumb{display:flex;align-items:center;gap:6px;font-size:.84rem;color:var(--cc-mute);margin-bottom:18px}
.cc-crumb button{background:none;border:0;color:var(--cc-mute);font:inherit;cursor:pointer;padding:0}
.cc-crumb button:hover{color:var(--cc-ink)}
.cc-head{display:flex;align-items:center;gap:22px;margin-bottom:30px}
.cc-avatar{width:88px;height:88px;flex:0 0 88px;border-radius:50%;background:#222 center/cover;border:2px solid rgba(255,255,255,.14)}
/* Banner behind the channel header: a looping scene for the channel's genre, fading into the page. */
.cc-banner{position:absolute;left:-32px;right:-32px;top:calc(-28px - var(--app-chrome-h, 0px));height:calc(min(460px,62vh) + var(--app-chrome-h, 0px));overflow:hidden;z-index:0;pointer-events:none;-webkit-mask-image:linear-gradient(#000 35%,transparent);mask-image:linear-gradient(#000 35%,transparent)}
.cc-banner video{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .45s ease}
.cc-banner video.is-on{opacity:.4}
.cc-banner::after{content:"";position:absolute;inset:0;background:linear-gradient(to right,rgba(11,11,12,.55),rgba(11,11,12,.1) 55%,rgba(11,11,12,.35))}
.cc-page{position:relative;z-index:1}
/* Avatar and name are editable: pencil badges like a profile page. */
.cc-ava{position:relative;flex:0 0 auto}
.cc-ava .cc-avatar{width:112px;height:112px;flex-basis:112px;border:3px solid rgba(255,255,255,.12);box-shadow:0 12px 34px rgba(0,0,0,.5)}
.cc-pen{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:rgba(30,30,33,.92);border:1px solid rgba(255,255,255,.16);color:rgba(255,255,255,.8);cursor:pointer;flex:0 0 auto;transition:background .15s,color .15s}
.cc-pen:hover{background:#fff;color:#111}
.cc-pen svg{width:14px;height:14px}
.cc-ava .cc-pen{position:absolute;right:0;bottom:2px;width:34px;height:34px}
.cc-ava input[type=file]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.cc-name-row{display:flex;align-items:center;gap:10px;min-width:0}
.cc-name-row .cc-name{width:auto;min-width:4ch;max-width:100%;field-sizing:content}
.cc-name{display:block;width:100%;background:transparent;border:0;border-bottom:1px dashed transparent;color:var(--cc-ink);font-size:clamp(1.9rem,4vw,2.9rem);padding:0 0 2px;margin:0}
.cc-name:hover{border-bottom-color:rgba(255,255,255,.25)}
.cc-name:focus{border-bottom-color:rgba(255,255,255,.6)}
.cc-prompt{margin-top:6px;font-size:.8rem;color:var(--cc-mute)}
.cc-prompt b{display:block;color:var(--cc-ink);font-weight:500;font-size:.9rem;margin-top:1px}
.cc-h2{margin:0 0 14px;font-size:clamp(1.4rem,2.6vw,1.9rem)}
.cc-card{border-radius:22px;background:#18181a;border:1px solid var(--cc-line);padding:12px}
.cc-card textarea{width:100%;box-sizing:border-box;background:transparent;border:0;color:var(--cc-ink);font:inherit;font-size:1rem;resize:none;min-height:52px;padding:4px 6px}
.cc-topics{display:flex;flex-direction:column;gap:6px;margin-top:12px}
.cc-topic{display:flex;align-items:center;gap:12px;width:100%;padding:13px 16px;border-radius:16px;border:1px solid var(--cc-line);background:#18181a;color:var(--cc-ink);font:inherit;font-size:.92rem;text-align:left;cursor:pointer}
.cc-topic:hover{background:#1f1f22}
.cc-topic i{flex:0 0 18px;width:18px;height:18px;border-radius:5px;border:1.5px solid rgba(255,255,255,.35);display:grid;place-items:center;font-style:normal;font-size:.7rem}
.cc-topic.is-on{border-color:#fff;background:#1f1f22}
.cc-topic.is-on i{background:#fff;border-color:#fff;color:#111}
.cc-more{display:flex;justify-content:flex-end;margin-top:8px}
.cc-stylebar{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.cc-search{height:42px;padding:0 14px;border-radius:12px;border:1px solid var(--cc-line);background:#18181a;color:var(--cc-ink);font:inherit;font-size:.95rem}
.cc-search:focus{outline:none;border-color:rgba(255,255,255,.35)}
.cc-style[hidden]{display:none}
.cc-styles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.cc-style{position:relative;display:flex;flex-direction:column;gap:8px;padding:8px;border-radius:16px;border:2px solid transparent;background:#18181a;color:var(--cc-ink);font:inherit;font-size:.88rem;font-weight:500;text-align:left;cursor:pointer}
.cc-style img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;display:block;background:#111}
.cc-style.is-on{border-color:#fff}
.cc-check{position:absolute;top:14px;right:14px;width:22px;height:22px;border-radius:6px;background:#fff;color:#111;display:grid;place-items:center;font-size:.8rem;font-weight:600}
.cc-voices{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.cc-voice{position:relative;display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:16px;border:2px solid transparent;background:#18181a;color:var(--cc-ink);font:inherit;text-align:left;cursor:pointer;min-width:0}
.cc-voice.is-on{border-color:#fff}
.cc-voice-top{display:flex;align-items:center;gap:10px;min-width:0}
.cc-face{width:38px;height:38px;flex:0 0 38px;border-radius:50%}
.cc-voice-top b{display:block;font-size:.95rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cc-voice-top span{display:block;font-size:.74rem;color:var(--cc-mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:capitalize}
.cc-voice-play{display:flex;align-items:center;gap:8px}
.cc-play{flex:0 0 28px;width:28px;height:28px;border-radius:50%;border:0;background:#fff;color:#111;display:grid;place-items:center;cursor:pointer}
.cc-play:focus-visible{outline:2px solid #fff;outline-offset:2px}
.cc-wave{flex:1;height:22px;display:flex;align-items:center;gap:2px;min-width:0;overflow:hidden}
.cc-wave i{flex:1 0 2px;max-width:3px;border-radius:2px;background:rgba(255,255,255,.28);transform-origin:center;transition:background .12s}
/* While a voice plays, the bars pulse and fill in white as the clip goes. */
.cc-wave.is-playing i{animation:ccBar .8s ease-in-out infinite}
.cc-wave i.on{background:#fff}
@keyframes ccBar{0%,100%{transform:scaleY(.45)}50%{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){.cc-wave.is-playing i{animation:none}}
.cc-sec{margin-top:26px}
.cc-sec h3{margin:0 0 10px;font-size:1rem;font-weight:500}
.cc-sec p{margin:-4px 0 10px;font-size:.84rem;color:var(--cc-mute)}
.cc-tabs{display:inline-flex;gap:4px;padding:4px;border-radius:999px;background:#18181a;margin-bottom:14px}
.cc-tab{height:36px;padding:0 16px;border-radius:999px;border:0;background:transparent;color:var(--cc-mute);font:inherit;font-size:.88rem;font-weight:500;cursor:pointer}
.cc-tab.is-on{background:#fff;color:#111}
.cc-tab:focus-visible,.cc-mode:focus-visible,.cc-cap:focus-visible{outline:2px solid #fff;outline-offset:2px}
.cc-own input{width:100%;box-sizing:border-box;background:transparent;border:0;border-bottom:1px solid var(--cc-line);color:var(--cc-ink);font:inherit;font-size:1rem;font-weight:500;padding:6px 6px 10px;margin-bottom:6px}
.cc-own textarea{min-height:220px}
.cc-modes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.cc-mode{display:flex;flex-direction:column;gap:4px;padding:14px;border-radius:16px;border:2px solid transparent;background:#18181a;color:var(--cc-ink);font:inherit;text-align:left;cursor:pointer}
.cc-mode b{font-size:.95rem}
.cc-mode span{font-size:.8rem;color:var(--cc-mute)}
.cc-mode.is-on{border-color:#fff}
.cc-char{display:flex;gap:10px;align-items:center}
.cc-char input{flex:1;min-width:0;height:44px;box-sizing:border-box;padding:0 14px;border-radius:999px;border:1px solid var(--cc-line);background:#18181a;color:var(--cc-ink);font:inherit;font-size:.9rem}
.cc-char-on{display:flex;gap:12px;align-items:center;padding:10px;border-radius:16px;background:#18181a}
.cc-char-on img{width:64px;height:64px;border-radius:12px;object-fit:cover;background:#111}
.cc-caps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.cc-cap{position:relative;display:flex;flex-direction:column;gap:8px;padding:8px;border-radius:16px;border:2px solid transparent;background:#18181a;color:var(--cc-ink);font:inherit;font-size:.88rem;font-weight:500;text-align:left;cursor:pointer}
.cc-cap.is-on{border-color:#fff}
.cc-cap-frame{position:relative;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#111 center/cover;container-type:size}
.cc-cap-frame::after{content:"";position:absolute;inset:45% 0 0;background:linear-gradient(180deg,transparent,rgba(0,0,0,.6))}
.cc-cap-frame b{position:absolute;z-index:1;left:4%;right:4%;bottom:10%;text-align:center;line-height:1.1;font-weight:600}
.cc-rail{position:sticky;top:8px;align-self:start;display:flex;flex-direction:column;gap:18px}
.cc-steps{display:flex;flex-direction:column;gap:2px;position:relative}
.cc-step{display:flex;align-items:center;gap:12px;padding:8px 6px;border:0;background:none;color:var(--cc-mute);font:inherit;text-align:left;cursor:pointer;border-radius:10px}
.cc-step:disabled{cursor:default}
.cc-step i{width:30px;height:30px;flex:0 0 30px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:.8rem;font-weight:600;background:#222;border:1px solid var(--cc-line);color:var(--cc-ink)}
.cc-step small{display:block;font-size:.68rem;letter-spacing:.06em;text-transform:uppercase}
.cc-step span{font-size:.88rem;font-weight:500;color:var(--cc-ink)}
.cc-step.is-on i{background:#fff;color:#111;border-color:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.15)}
.cc-step.is-done i{background:rgba(74,222,128,.18);color:#4ade80;border-color:transparent}
.cc-nav{display:flex;gap:8px}
.cc-nav .cc-btn.is-primary{flex:1}
.cc-note{font-size:.78rem;color:var(--cc-mute);line-height:1.4}
.cc-loading{display:flex;flex-direction:column;gap:6px}
.cc-loading div{height:46px;border-radius:12px;background:linear-gradient(90deg,#18181a 0%,#222225 50%,#18181a 100%);background-size:200% 100%;animation:ccShine 1.2s linear infinite}
@keyframes ccShine{to{background-position:-200% 0}}
@media (max-width:1000px){.cc-page{grid-template-columns:minmax(0,1fr)}.cc-rail{position:static;order:-1}.cc-steps{flex-direction:row;overflow-x:auto}.cc-step small{display:none}.cc-voices{grid-template-columns:repeat(2,minmax(0,1fr))}.cc-styles{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){.cc-cats{gap:6px}.cc-cat{height:48px;border-radius:12px}.cc-cat.is-on{height:56px;flex-grow:1.12}.cc-cat span{font-size:10.5px;padding:2px 7px;margin:4px}.cc-ava .cc-avatar{width:76px;height:76px;flex-basis:76px}.cc-ava .cc-pen{width:28px;height:28px}.cc-banner{height:360px;top:calc(-16px - var(--app-chrome-h, 0px));left:-12px;right:-12px}.cc-hero{padding:32px 6px 40px;gap:16px}.cc-box{flex-direction:column;align-items:stretch;border-radius:22px}.cc-next{width:100%}.cc-head{gap:12px}.cc-avatar{width:64px;height:64px;flex-basis:64px}}
@media (prefers-reduced-motion:reduce){.cc-loading div{animation:none}}
/* ── New look (Nov 2026): plain dark page, Inter headings, blue accent, like the Agents page ── */
.cc{--cc-ink:#ededec;--cc-mute:#8d8d8b;--cc-line:rgba(255,255,255,.09)}
.cc-hero .hero-pin{display:none!important}
.cc-display{font-family:Inter,system-ui,-apple-system,sans-serif;font-weight:500;letter-spacing:-.02em;line-height:1.15;color:#ededec}
.cc-hero{gap:20px;padding:64px 16px 48px}
.cc-hero h1,.cc-hero:has(.cc-cats) h1{font-size:28px;max-width:none}
.cc-cats{gap:6px;width:min(620px,100%);margin:6px auto -10px}
.cc-cat{height:48px;border-radius:10px;border-color:rgba(255,255,255,.1)}
.cc-cat.is-on{height:56px;border:1px solid #ff2d48;box-shadow:0 0 0 3px rgba(255,45,72,.18)}
.cc-cat.is-on span{background:#c41530;color:#fff}
.cc-box{width:min(620px,100%);border-radius:18px;padding:10px 10px 10px 16px;background:#1c1c1d;border-color:rgba(255,255,255,.12)}
.cc-box textarea{font-size:15px}
.cc-next{height:36px;padding:0 15px;border-radius:9px;font-size:13.5px;font-weight:500;background:#c41530;color:#fff;border:1px solid #ff2d48}
.cc-next:disabled{background:#c41530;color:#fff;opacity:.4}
.cc-btn{height:36px;padding:0 15px;border-radius:9px;font-size:13.5px;font-weight:500}
.cc-btn.is-primary{background:#c41530;color:#fff;border:1px solid #ff2d48}
.cc-btn.is-primary:hover{background:#e0203c;color:#fff}
.cc-chip{height:28px;padding:0 10px;border-radius:8px;font-size:12.5px}
.cc-chip.is-on{background:#ededec;color:#111;border-color:#ededec}
.cc-tab{height:30px;padding:0 13px;border-radius:8px;font-size:13px}
.cc-tab.is-on{background:#3b3b3c;color:#ededec}
.cc-crumb{font-size:12.5px;margin-bottom:14px}
.cc-head{gap:16px;margin-bottom:22px}
.cc-avatar{width:64px;height:64px;flex-basis:64px}
.cc-name{font-size:24px!important}
.cc-prompt{font-size:12px}.cc-prompt b{font-size:13px}
.cc-card{border-radius:14px;background:#1a1a1b}
.cc-card textarea{font-size:14px}
.cc-topic{padding:10px 13px;border-radius:11px;font-size:13.5px;background:#1a1a1b}
.cc-topic.is-on{border-color:#ff2d48;background:rgba(255,45,72,.08)}
.cc-search{height:36px;border-radius:9px;font-size:13.5px}
.cc-style,.cc-voice,.cc-mode{border-radius:12px;background:#1a1a1b}
.cc-style.is-on,.cc-voice.is-on,.cc-mode.is-on{border-color:#ff2d48}
.cc-check{background:#ff2d48;color:#fff}
.cc-play{background:#c41530;color:#fff;box-shadow:0 0 0 1px #ff2d48}
.cc-sec{margin-top:22px}
.cc-sec p{font-size:12.5px}
.cc-step{gap:10px;padding:6px}
.cc-step i{width:24px;height:24px;flex-basis:24px;font-size:11px;font-weight:500}
.cc-step small{font-size:10.5px;letter-spacing:.04em}
.cc-step span{font-size:13px;font-weight:500}
.cc-step.is-on i{background:#c41530;color:#fff;border-color:#ff2d48;box-shadow:0 0 0 3px rgba(255,45,72,.18)}
.cc-manager p{border-radius:6px 12px 12px 12px;font-size:13px;background:#1a1a1b;backdrop-filter:none;-webkit-backdrop-filter:none}
.cc h2,.cc-sec h2,.cc-sec h3{font-family:Inter,system-ui,sans-serif!important;font-weight:500!important;font-size:18px!important;letter-spacing:-.01em}
.cc-topic.is-on i{background:#ff2d48;border-color:#ff2d48;color:#fff}

`

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const PLAY = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'
const PAUSE = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'

export function initChannelCreator({ root, getUser } = {}) {
  if (!root) return null
  if (!document.getElementById('cc-style')) {
    const el = document.createElement('style')
    el.id = 'cc-style'
    el.textContent = CSS
    document.head.appendChild(el)
  }
  const state = () => { try { return window.fvAgentsState?.() || null } catch (_) { return null } }
  const fresh = () => ({ genre: '', about: '', nicheId: '', name: '', topics: [], topic: '', style: '', voiceId: '', durationId: 'long_600', aspect: '16:9', angle: '', mode: 'cheapest', pace: 'normal', captions: '', scriptMode: 'write', ownTitle: '', ownText: '', charDesc: '', charUrl: '', reference: null, avatar: '' })
  let c = fresh()
  let screen = 'hero' // 'hero' | 'topic' | 'style' | 'voice' | 'captions'
  let busy = false
  let from = '' // where to go back to when the user leaves
  let audio = null
  let playing = ''
  let charBusy = false
  let refOpen = false
  let refBusy = false
  let waitingForPlan = false
  let autoBusy = false
  // Start screen, like the landing page: four channel types with a scene each, and proven ideas the
  // Manager can drop in ("Let agent choose").
  const HERO_CATS = [
    { id: 'education', name: 'Education', idea: 'Channel that explains how everyday things really work' },
    { id: 'history', name: 'History', idea: 'Channel about how ordinary people lived in ancient Rome' },
    { id: 'mystery', name: 'Mystery', idea: 'Channel about famous heists and unsolved cases' },
    { id: 'storytelling', name: 'Storytelling', idea: 'Channel with dark fantasy tales told like epics' },
  ]
  const HERO_IDEAS = {
    education: ['Channel that explains how everyday things really work', 'Channel about the psychology behind everyday habits', 'Channel explaining how money, banks and the economy actually work', 'Channel about the science of the human body', 'Channel about how giant engineering projects get built'],
    history: ['Channel about how ordinary people lived in ancient Rome', 'Channel about the strangest events in medieval history', 'Channel about the rise and fall of great empires', 'Channel about the battles that changed history', 'Channel about forgotten civilisations and what happened to them'],
    mystery: ['Channel about famous heists and how they were pulled off', 'Channel about unsolved disappearances', 'Channel about the biggest cons and scams in history', 'Channel about places scientists still cannot explain', 'Channel about cold cases cracked decades later'],
    storytelling: ['Channel about the rise and fall of famous companies', 'Channel retelling Greek myths as epic stories', 'Channel with dark fantasy tales told like epics', 'Channel about the lives of history\'s most ruthless rulers', 'Channel telling true survival stories'],
  }
  const heroCat = () => (HERO_CATS.some((x) => x.id === c.genre) ? c.genre : 'education')
  let refErr = ''
  let charErr = ''

  function firstName() {
    let u = null
    try { u = getUser?.() } catch (_) {}
    const n = String(u?.name || u?.full_name || '').trim().split(/\s+/)[0]
    return n && !/^preview$/i.test(n) ? n : ''
  }
  function manager(text) {
    return `<div class="cc-manager">${agentSvg('manager')}<p><b>Manager</b>${esc(text)}</p></div>`
  }
  function play(src, id) {
    if (audio && playing === id && !audio.paused) { audio.pause(); playing = ''; return render() }
    try { audio?.pause() } catch (_) {}
    audio = new Audio(src)
    playing = id
    audio.onended = () => { playing = ''; render() }
    // Fill the bars in as the clip plays, without redrawing the page.
    audio.ontimeupdate = () => {
      const bars = root.querySelectorAll(`[data-cc-wave="${window.CSS.escape(id)}"] i`)
      if (!bars.length || !audio.duration) return
      const upto = Math.round((audio.currentTime / audio.duration) * bars.length)
      bars.forEach((b, k) => b.classList.toggle('on', k < upto))
    }
    audio.play().catch(() => { playing = ''; render() })
    render()
  }

  // ── screens ──
  function heroHtml() {
    return `<section class="cc-hero">
  <span class="hero-pin pin-you" aria-hidden="true"><svg class="blob" viewBox="0 0 40 40" aria-hidden="true"><g class="body"><g transform="translate(-9.01 -4.47) scale(.58)"><rect x="48.4" y="16" width="3.2" height="14" rx="1.6"/><circle cx="50" cy="16" r="4.5"/><path d="M22 38c0-6 3-9 9-9.6 12-1 26-1 38 0 6 .6 9 3.6 9 9.6v24c0 6-3 9-9 9.6-12 1-26 1-38 0-6-.6-9-3.6-9-9.6z"/></g></g><g class="eyes" style="fill:#fff"><rect x="14.8" y="19.9" width="3.5" height="7.5" rx="1.75"/><rect x="21.7" y="19.9" width="3.5" height="7.5" rx="1.75"/></g></svg><b>Manager</b></span>
  <span class="hero-pin pin-script" aria-hidden="true"><svg class="blob" viewBox="0 0 40 40" aria-hidden="true"><g class="body"><rect x="7" y="7" width="26" height="26" rx="8" transform="rotate(-12 20 20)"/></g><g class="eyes"><rect x="15.4" y="16" width="3.6" height="7.2" rx="1.8"/><rect x="21.4" y="16" width="3.6" height="7.2" rx="1.8"/></g></svg><b>Script</b></span>
  <span class="hero-pin pin-voice" aria-hidden="true"><svg class="blob" viewBox="0 0 40 40" aria-hidden="true"><g class="body"><path d="M20 8L34 31H6Z" stroke-width="7" stroke-linejoin="round"/></g><g class="eyes"><rect x="15.6" y="20.5" width="3.6" height="7.2" rx="1.8"/><rect x="21" y="20.5" width="3.6" height="7.2" rx="1.8"/></g></svg><b>Voice</b></span>
  <span class="hero-pin pin-agent" aria-hidden="true"><svg class="blob" viewBox="0 0 40 40" aria-hidden="true"><g class="body"><circle cx="29.00" cy="20.00" r="7"/><circle cx="24.50" cy="27.79" r="7"/><circle cx="15.50" cy="27.79" r="7"/><circle cx="11.00" cy="20.00" r="7"/><circle cx="15.50" cy="12.21" r="7"/><circle cx="24.50" cy="12.21" r="7"/><circle cx="20" cy="20" r="10"/></g><g class="eyes"><rect x="15.4" y="16.3" width="3.6" height="7.2" rx="1.8"/><rect x="21.4" y="16.3" width="3.6" height="7.2" rx="1.8"/></g></svg><b>Agent</b></span>
      <h1 class="cc-display">Let agents run your YouTube channel</h1>
      <div class="cc-cats" role="radiogroup" aria-label="Channel type">${HERO_CATS.map((x) => `<button type="button" class="cc-cat${heroCat() === x.id ? ' is-on' : ''}" role="radio" aria-checked="${heroCat() === x.id}" data-cc-cat="${x.id}"><video muted loop playsinline autoplay poster="https://pub-491b074b69d84792b488d1a85c6e39eb.r2.dev/img/hero-${x.id}-tile.jpg" src="https://pub-491b074b69d84792b488d1a85c6e39eb.r2.dev/vid/hero-${x.id}-tile.mp4" aria-hidden="true"></video><span>${x.name}</span></button>`).join('')}</div>
      <form class="cc-box" data-cc-about-form>
        <div class="cc-box-main">
          <label class="sr-only" for="cc-about">What is the channel about?</label>
          <textarea id="cc-about" rows="2" maxlength="300" placeholder="${esc((HERO_CATS.find((x) => x.id === heroCat()) || HERO_CATS[0]).idea)}">${esc(c.about)}</textarea>
          ${refOpen ? `<div class="cc-ref-row"><label class="sr-only" for="cc-ref">YouTube channel link</label><input id="cc-ref" data-cc-ref-in type="url" inputmode="url" placeholder="youtube.com/@channel you want to be like" autocomplete="off"><button type="button" class="cc-chip is-on" data-cc-ref-go${refBusy ? ' disabled' : ''}>${refBusy ? 'Reading…' : 'Read channel'}</button><button type="button" class="cc-chip" data-cc-ref-close aria-label="Close">✕</button></div>${refErr ? `<div class="cc-note" style="padding:0 6px">${esc(refErr)}</div>` : ''}` : ''}
          <div class="cc-tools"><button type="button" class="cc-chip${c.reference ? ' is-on' : ''}" data-cc-ref-open><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1"/></svg>Reference</button><button type="button" class="cc-chip" data-cc-auto${autoBusy ? ' disabled' : ''}><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>${autoBusy ? 'Choosing…' : 'Let agent choose'}</button></div>
        </div>
        <button type="submit" class="cc-next" data-cc-next ${c.about.trim().length >= 3 && !busy ? '' : 'disabled'}>${busy ? 'Thinking…' : 'Next →'}</button>
      </form>
      ${c.reference ? `<div class="cc-refcard">${manager(`I read ${c.reference.title || 'that channel'}: ${c.reference.summary || 'got it.'} I set your channel up the same way, so check the description above.`)}<button type="button" class="cc-skip" data-cc-ref-clear>Remove reference</button></div>` : ''}
      ${from ? '<button type="button" class="cc-skip" data-cc-leave>Not now</button>' : '<button type="button" class="cc-skip" data-cc-skip>Skip, I\'ll set it up later</button>'}
    </section>`
  }

  function railHtml() {
    const i = CREATOR_STEPS.findIndex((x) => x.id === screen)
    const step = CREATOR_STEPS[i]
    const canNext = screen === 'topic' ? (c.scriptMode === 'own' ? scriptEstimate(c.ownText).words >= 40 : c.topic.trim().length >= 4) : screen === 'style' ? !!c.style : true
    const last = i === CREATOR_STEPS.length - 1
    return `<aside class="cc-rail" aria-label="Steps">
      ${manager(screen === 'topic' && busy ? 'Naming your channel and finding first episodes…' : step.say)}
      <nav class="cc-steps">${CREATOR_STEPS.map((x, k) => `<button type="button" class="cc-step${k === i ? ' is-on' : ''}${k < i ? ' is-done' : ''}" data-cc-step="${x.id}" ${k <= i ? '' : 'disabled'} aria-current="${k === i ? 'step' : 'false'}"><i>${k < i ? '✓' : k + 1}</i><div><small>Step ${k + 1}</small><span>${esc(x.name)}</span></div></button>`).join('')}</nav>
      <div class="cc-nav"><button type="button" class="cc-btn" data-cc-back aria-label="Back">←</button>${last ? `<button type="button" class="cc-btn is-primary" data-cc-finish="make">Create video</button>` : `<button type="button" class="cc-btn is-primary" data-cc-next-step ${canNext ? '' : 'disabled'}>Next</button>`}</div>
      ${last ? '<button type="button" class="cc-skip" data-cc-finish="only">Only create the channel</button><div class="cc-note">Everything here becomes the settings for this channel. Change them any time under Channels.</div>' : ''}
    </aside>`
  }

  function headHtml() {
    const g = genreById(c.genre) || GENRES[0]
    return `<div class="cc-crumb"><button type="button" data-cc-hero>‹ Start</button><span>/</span><span>${esc(c.name || 'New channel')}</span></div>
      <div class="cc-head"><div class="cc-ava"><div class="cc-avatar"${c.avatar || c.genre ? ` style="background-image:url('${c.avatar ? c.avatar : `https://pub-491b074b69d84792b488d1a85c6e39eb.r2.dev/img/genres/${esc(g.id)}.jpg`}')"` : ''} aria-hidden="true"></div>
          <label class="cc-pen" title="Change channel picture"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg><span class="sr-only">Change channel picture</span><input type="file" accept="image/*" data-cc-ava-file></label></div>
        <div style="min-width:0;flex:1"><div class="cc-name-row"><label class="sr-only" for="cc-name">Channel name</label><input id="cc-name" class="cc-name cc-display" data-cc-name maxlength="40" placeholder="New channel" value="${esc(c.name)}" autocomplete="off"><button type="button" class="cc-pen" data-cc-name-pen title="Rename channel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg><span class="sr-only">Rename channel</span></button></div>
          <div class="cc-prompt">Initial prompt<b>${esc(c.about)}</b></div></div></div>`
  }

  function topicHtml() {
    const own = c.scriptMode === 'own'
    const est = scriptEstimate(c.ownText)
    const tabs = `<div class="cc-tabs" role="tablist"><button type="button" role="tab" class="cc-tab${own ? '' : ' is-on'}" aria-selected="${!own}" data-cc-mode="write">Write it for me</button><button type="button" role="tab" class="cc-tab${own ? ' is-on' : ''}" aria-selected="${own}" data-cc-mode="own">I have a script</button></div>`
    const angles = `<div class="cc-sec"><h3>Script angle</h3><div class="cc-chips">${ANGLES.map((a) => `<button type="button" class="cc-chip${(c.angle || 'auto') === a.id ? ' is-on' : ''}" data-cc-angle="${esc(a.id)}">${esc(a.name)}</button>`).join('')}</div></div>`
    if (own) {
      return `${headHtml()}
      <h2 class="cc-h2 cc-display">Your first episode</h2>${tabs}
      <div class="cc-card cc-own">
        <label class="sr-only" for="cc-own-title">Working title</label><input id="cc-own-title" data-cc-own-title maxlength="120" placeholder="Working title (optional)" value="${esc(c.ownTitle)}" autocomplete="off">
        <label class="sr-only" for="cc-own-text">Your script</label><textarea id="cc-own-text" data-cc-own-text placeholder="Paste the narration. Blank lines split it into sections; ## Heading lines name them.">${esc(c.ownText)}</textarea>
        <div class="cc-chips">${[['16:9', '16:9'], ['9:16', '9:16']].map(([v, l]) => `<button type="button" class="cc-chip${c.aspect === v ? ' is-on' : ''}" data-cc-aspect="${v}">${l}</button>`).join('')}<span class="cc-note" data-cc-est style="margin-left:6px;align-self:center">${esc(est.label || 'At least 40 words. Length follows your script.')}</span></div>
      </div>`
    }
    return `${headHtml()}
      <h2 class="cc-h2 cc-display">Pick the first episode</h2>${tabs}
      <div class="cc-card">
        <label class="sr-only" for="cc-topic">First episode topic</label>
        <textarea id="cc-topic" rows="2" maxlength="200" placeholder="What is the first episode about?" data-cc-topic-in>${esc(c.topic)}</textarea>
        <div class="cc-chips">
          ${[['16:9', '16:9'], ['9:16', '9:16']].map(([v, l]) => `<button type="button" class="cc-chip${c.aspect === v ? ' is-on' : ''}" data-cc-aspect="${v}">${l}</button>`).join('')}
          <span style="width:8px"></span>
          ${lengthOptions(lenCap()).map((o) => o.locked
            ? `<button type="button" class="cc-chip is-locked" data-cc-len-locked title="Needs the ${esc(o.unlock)} plan">${esc(o.label)} · ${esc(o.unlock)}</button>`
            : `<button type="button" class="cc-chip${c.durationId === o.id ? ' is-on' : ''}" data-cc-len="${o.id}">${esc(o.label)}</button>`).join('')}
        </div>
      </div>
      ${busy ? '<div class="cc-topics cc-loading" aria-label="Writing topics">' + '<div></div>'.repeat(4) + '</div>' : `<div class="cc-topics" role="radiogroup" aria-label="Suggested topics">${c.topics.map((t) => `<button type="button" class="cc-topic${c.topic === t ? ' is-on' : ''}" role="radio" aria-checked="${c.topic === t}" data-cc-topic="${esc(t)}"><i>${c.topic === t ? '✓' : ''}</i>${esc(t)}</button>`).join('')}</div>
      <div class="cc-more"><button type="button" class="cc-skip" data-cc-regen>↻ Suggest new topics</button></div>`}
      ${angles}`
  }

  function styleHtml() {
    const sug = genreById(c.genre)?.styles || []
    const list = [...sug.map(visualStyleById).filter(Boolean), ...VISUAL_STYLES.filter((x) => !sug.includes(x.id))]
    return `${headHtml()}
      <h2 class="cc-h2 cc-display">Pick a style</h2>
      <div class="cc-stylebar"><label class="sr-only" for="cc-style-q">Search styles</label><input id="cc-style-q" class="cc-search" type="search" data-cc-style-q placeholder="Search ${VISUAL_STYLES.length} styles" autocomplete="off">
        <div class="cc-chips" role="group" aria-label="Style groups"><button type="button" class="cc-chip is-on" data-cc-group="">All</button>${sug.length ? '<button type="button" class="cc-chip" data-cc-group="Suggested">Suggested</button>' : ''}${STYLE_GROUPS.map((g) => `<button type="button" class="cc-chip" data-cc-group="${esc(g)}">${esc(g)}</button>`).join('')}</div></div>
      <div class="cc-styles" role="radiogroup" aria-label="Video style">${list.map((x) => `<button type="button" class="cc-style${c.style === x.id ? ' is-on' : ''}" role="radio" aria-checked="${c.style === x.id}" data-cc-style="${esc(x.id)}" data-group="${esc(x.group)}" data-sug="${sug.includes(x.id) ? '1' : ''}" data-name="${esc((x.name + ' ' + x.group + ' ' + x.prompt).toLowerCase())}"><img src="${esc(styleSample(x.id, c.genre))}" alt="" loading="lazy">${c.style === x.id ? '<span class="cc-check" aria-hidden="true">✓</span>' : ''}${esc(x.name)}</button>`).join('')}</div>
      <p class="cc-note" data-cc-style-none hidden>No style matches that search.</p>
      <div class="cc-sec"><h3>Visual mode</h3><p>How many scenes move. Animated scenes take a few minutes each to make.</p><div class="cc-modes" role="radiogroup" aria-label="Visual mode">${VISUAL_MODES.map((m) => `<button type="button" class="cc-mode${c.mode === m.id ? ' is-on' : ''}" role="radio" aria-checked="${c.mode === m.id}" data-cc-vmode="${esc(m.id)}"><b>${esc(m.name)}</b><span>${esc(m.note)}</span></button>`).join('')}</div></div>
      <div class="cc-sec"><h3>Scene pace</h3><div class="cc-chips">${SCENE_PACES.map((p) => `<button type="button" class="cc-chip${c.pace === p.id ? ' is-on' : ''}" data-cc-pace="${esc(p.id)}">${esc(p.name)} · new scene every ${p.seconds}s</button>`).join('')}</div></div>
      <div class="cc-sec"><h3>Consistent character <span style="color:var(--cc-mute);font-weight:400">(optional)</span></h3><p>The same person appears in every scene where a person fits.</p>
        ${c.charUrl ? `<div class="cc-char-on"><img src="${esc(c.charUrl)}" alt="Character reference"><div style="flex:1;min-width:0"><b>${esc(c.charDesc)}</b></div><button type="button" class="cc-btn" data-cc-char-clear>Remove</button></div>` : `
        <form class="cc-char" data-cc-char-form><label class="sr-only" for="cc-char">Describe the character</label><input id="cc-char" maxlength="200" placeholder="e.g. a bald man in his 40s with a grey beard and round glasses" value="${esc(c.charDesc)}" autocomplete="off"><button type="submit" class="cc-btn"${charBusy ? ' disabled' : ''}>${charBusy ? 'Drawing…' : 'Create character'}</button></form>${charErr ? `<p class="cc-note" style="margin-top:8px">${esc(charErr)}</p>` : ''}`}
      </div>`
  }

  function capStyleFor(l) {
    const size = Number(l.size) || 64
    const w = l.stroke ? ((Number(l.strokeW) || 3) / 10.8).toFixed(3) + 'cqh' : ''
    const stroke = w ? [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) => `calc(${x} * ${w}) calc(${y} * ${w}) 0 ${l.stroke}`).join(',') : ''
    const shadow = l.shadow || !l.stroke ? '0 2px 8px rgba(0,0,0,.85)' : ''
    // Twice the real size: at thumbnail scale the true size is a few pixels and can't be read.
    return `font-family:'${l.font}',Impact,sans-serif;font-size:${Math.min(22, (size / 10.8) * 2).toFixed(2)}cqh;color:${l.base || '#fff'};text-shadow:${[stroke, shadow].filter(Boolean).join(',') || 'none'}`
  }
  function captionsHtml() {
    let looks = []
    try { looks = window.fvCaptionLooks?.() || [] } catch (_) {}
    const key = voiceGroupFor({ genre: c.genre, niche: c.nicheId, about: c.about })
    const cur = c.captions || (looks.some((l) => l.id === captionLookFor(key)) ? captionLookFor(key) : '') || genreById(c.genre)?.captions || looks[0]?.id
    const img = styleSample(c.style || (genreById(c.genre) || GENRES[0]).styles[0], c.genre)
    return `${headHtml()}
      <h2 class="cc-h2 cc-display">Pick captions</h2>
      <div class="cc-caps" role="radiogroup" aria-label="Caption style">${looks.map((l) => `<button type="button" class="cc-cap${cur === l.id ? ' is-on' : ''}" role="radio" aria-checked="${cur === l.id}" data-cc-cap="${esc(l.id)}"><span class="cc-cap-frame" style="background-image:url('${esc(img)}')"><b style="${capStyleFor(l)}">Your <span style="color:${esc(l.hl)}">captions</span> here</b></span>${cur === l.id ? '<span class="cc-check" aria-hidden="true">✓</span>' : ''}${esc(l.name)}</button>`).join('')}</div>
      <p class="cc-note" style="margin-top:12px">Shown on your chosen style at the size the video uses. Fine-tune font, colours and outline under Channels.</p>`
  }

  function voiceHtml() {
    const st = state()
    // Best-fitting narrators for this kind of channel first, the best one picked already.
    const key = voiceGroupFor({ genre: c.genre, niche: c.nicheId, about: c.about })
    const raw = st?.voices || []
    const list = rankVoices(raw, key)
    const best = new Set(bestForIds(raw, key))
    if (!c.voiceId && list[0]) c.voiceId = list[0].id
    const wave = (id) => { let h = hueFor(id); return Array.from({ length: 34 }, (_, k) => { h = (h * 9301 + 49297) % 233280; return `<i style="height:${30 + (h % 70)}%;animation-delay:-${((k * 7) % 11) * 0.07}s"></i>` }).join('') }
    return `${headHtml()}
      <h2 class="cc-h2 cc-display">Pick a narrator</h2>
      ${list.length ? `<div class="cc-voices" role="radiogroup" aria-label="Narrator">${list.map((v) => {
        const on = c.voiceId === v.id
        const sub = [best.has(v.id) ? 'Best for ' + voiceGroup(key).label : '', v.gender, v.accent || v.category].filter(Boolean).join(' · ') || v.desc
        return `<div class="cc-voice${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" tabindex="0" data-cc-voice="${esc(v.id)}">
          ${on ? '<span class="cc-check" aria-hidden="true">✓</span>' : ''}
          <div class="cc-voice-top"><span class="cc-face" style="background:radial-gradient(circle at 35% 30%,hsl(${hueFor(v.name || v.id)} 80% 72%),hsl(${(hueFor(v.name || v.id) + 40) % 360} 70% 42%))" aria-hidden="true"></span><div style="min-width:0"><b>${esc(v.name || v.label)}</b><span>${esc(sub || '')}</span></div></div>
          ${v.preview ? `<div class="cc-voice-play"><button type="button" class="cc-play" data-cc-play="${esc(v.preview)}" data-id="${esc(v.id)}" aria-label="${playing === v.id ? 'Pause' : 'Play'} ${esc(v.name || v.label)}">${playing === v.id ? PAUSE : PLAY}</button><span class="cc-wave${playing === v.id ? ' is-playing' : ''}" data-cc-wave="${esc(v.id)}" aria-hidden="true">${wave(v.id)}</span></div>` : ''}
        </div>`
      }).join('')}</div>` : `<div class="cc-card"><p class="cc-note" style="margin:0">${esc(st?.voiceState === 'error' ? 'Voices load once you sign in. The channel uses the default narrator until you pick one under Channels.' : 'Loading voices…')}</p></div>`}`
  }

  // One banner element survives re-renders. Each category's video is made once and
  // kept in it, so switching is a cross-fade instead of a fresh download.
  const BANNER = { education: 'education', history: 'history', kids: 'kids', storytelling: 'storytelling', mystery: 'mystery', documentary: 'documentary' }
  const HERO_PRELOAD = ['education', 'history', 'mystery', 'storytelling']
  const still = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  let bannerEl = null
  function bannerVideo(id) {
    let v = bannerEl.querySelector(`video[data-cat="${id}"]`)
    if (v) return v
    v = document.createElement('video')
    v.dataset.cat = id
    v.muted = true; v.loop = true; v.playsInline = true
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '')
    v.preload = 'auto'
    v.poster = `https://pub-491b074b69d84792b488d1a85c6e39eb.r2.dev/img/hero-${id}.jpg`
    if (!still()) v.src = `https://pub-491b074b69d84792b488d1a85c6e39eb.r2.dev/vid/hero-${id}.mp4`
    bannerEl.appendChild(v)
    return v
  }
  function banner() {
    const id = BANNER[c.genre] || (screen === 'hero' ? 'education' : 'storytelling')
    if (!bannerEl) {
      bannerEl = document.createElement('div')
      bannerEl.className = 'cc-banner'
      bannerEl.setAttribute('aria-hidden', 'true')
    }
    bannerEl.dataset.cat = id
    const on = bannerVideo(id)
    // On the start screen, load the other categories in the background so a click is instant.
    if (screen === 'hero') HERO_PRELOAD.forEach((x) => bannerVideo(x))
    bannerEl.querySelectorAll('video').forEach((v) => {
      const active = v === on
      v.classList.toggle('is-on', active)
      if (active) { const p = v.play && v.src && v.play(); if (p && p.catch) p.catch(() => {}) } else if (!v.paused) { const off = v; setTimeout(() => { if (!off.classList.contains('is-on')) off.pause() }, 450) }
    })
    return bannerEl
  }

  // The setup in progress is kept in this browser, so a refresh lands back on the same step.
  const DRAFT = 'vidso_cc_draft'
  function saveDraft() {
    try {
      if (screen === 'hero') { localStorage.removeItem(DRAFT); return }
      localStorage.setItem(DRAFT, JSON.stringify({ c, screen, t: Date.now() }))
    } catch (_) {}
  }
  function readDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT) || 'null')
      if (!d || Date.now() - (d.t || 0) > 3 * 864e5 || !d.c || !CREATOR_STEPS.some((x) => x.id === d.screen)) return null
      return d
    } catch (_) { return null }
  }

  function render() {
    saveDraft()
    const keep = banner()
    keep.classList.toggle('is-hero', screen === 'hero')
    root.innerHTML = `<div class="cc">${screen === 'hero' ? heroHtml() : `<div class="cc-page"><main>${screen === 'topic' ? topicHtml() : screen === 'style' ? styleHtml() : screen === 'voice' ? voiceHtml() : captionsHtml()}</main>${railHtml()}</div>`}</div>`
    if (keep) {
      root.querySelector('.cc').prepend(keep)
      const v = keep.querySelector('video.is-on'); const pr = v && v.src && v.play && v.play(); if (pr && pr.catch) pr.catch(() => {})
    }
    bind()
  }

  function filterStyles() {
    const q = String(root.querySelector('[data-cc-style-q]')?.value || '').toLowerCase().split(/\s+/).filter(Boolean)
    const g = root.querySelector('[data-cc-group].is-on')?.dataset.ccGroup || ''
    let shown = 0
    root.querySelectorAll('[data-cc-style]').forEach((b) => {
      const ok = (!g || (g === 'Suggested' ? b.dataset.sug === '1' : b.dataset.group === g)) && q.every((w) => b.dataset.name.includes(w))
      b.hidden = !ok
      if (ok) shown++
    })
    const none = root.querySelector('[data-cc-style-none]')
    if (none) none.hidden = shown > 0
  }

  // ── actions ──
  async function suggest() {
    const g = genreById(c.genre) || GENRES[0]
    const n = c.nicheId ? nicheById(c.nicheId) : null
    busy = true
    render()
    let out = null
    try { out = await Promise.race([window.fvSetupChannel?.({ genre: c.genre ? g.name : '', about: c.about, niche: n?.name || '', reference: c.reference?.titles || [] }), new Promise((r) => setTimeout(() => r(null), 20000))]) } catch (_) {}
    const fb = fallbackChannel({ about: c.about, ideas: n?.ideas || [] })
    if (!c.name || c.name === fb.name) c.name = out?.name || c.name || fb.name
    c.topics = out?.topics?.length ? out.topics : fb.topics
    // The genre tile starts on Education, so unless a tile was clicked here, the topic decides:
    // the channel agent's genre first, else the kind of channel the words describe ("heists" -> Mystery).
    if (!c.genrePicked) {
      const fromTopic = GROUP_GENRE[voiceGroupFor({ genre: '', niche: c.nicheId, about: c.about })]
      c.genre = genreById(out?.genre)?.id || (topicGroupKnown(c) ? fromTopic : '') || c.genre || 'education'
    }
    if (!c.genre) c.genre = genreById(out?.genre)?.id || 'education'
    if (!c.topics.includes(c.topic)) c.topic = c.topics[0] || c.topic
    busy = false
  }
  async function toTopic() {
    screen = 'topic'
    await suggest()
    const g = genreById(c.genre) || GENRES[0]
    if (!c.style) c.style = g.styles[0]
    if (!c.angle) c.angle = g.angle
    if (!c.captions) {
      // Captions that suit this kind of channel (Neon for mystery, Hormozi for money…), if that look exists.
      const k = captionLookFor(voiceGroupFor({ genre: c.genre, niche: c.nicheId, about: c.about }))
      const looks = (() => { try { return window.fvCaptionLooks?.() || [] } catch (_) { return [] } })()
      c.captions = looks.some((l) => l.id === k) ? k : g.captions
    }
    render()
  }
  function finish(makeNow) {
    // Setup is free. Making the video needs a plan: show the paywall here and
    // pick up where they left off once the plan is active.
    if (makeNow && window.requireActivePlan && !window.requireActivePlan({ reason: 'create_video' })) {
      waitingForPlan = true
      return
    }
    waitingForPlan = false
    const g = genreById(c.genre) || GENRES[0]
    const n = c.nicheId ? nicheById(c.nicheId) : customNiche(c.about.replace(/^\s*(a\s+)?(youtube\s+)?channel\s+(about|on|for)\s+/i, '').replace(/^./, (x) => x.toUpperCase()).slice(0, 60))
    const voice = (state()?.voices || []).find((v) => v.id === c.voiceId)
    const own = c.scriptMode === 'own' && scriptEstimate(c.ownText).words >= 40
    const durationId = own ? nearestDuration(scriptEstimate(c.ownText).seconds).id : c.durationId
    const profile = normalizeProfile({
      name: (c.name || 'My channel').slice(0, 40),
      genre: g.id,
      about: c.about,
      niche: n?.id === 'custom' ? n.name : (n?.id || ''),
      visualStyle: c.style || g.styles[0],
      voiceId: voice?.id || '',
      voiceLabel: voice?.label || '',
      captions: c.captions || (() => { try { const k = captionLookFor(voiceGroupFor({ genre: c.genre, niche: c.nicheId, about: c.about })); return (window.fvCaptionLooks?.() || []).some((l) => l.id === k) ? k : '' } catch (_) { return '' } })() || g.captions,
      durationId,
      aspect: c.aspect,
      angle: c.angle || g.angle,
      visualMode: c.mode,
      scenePace: c.pace,
      characterUrl: c.charUrl,
      characterDesc: c.charUrl ? c.charDesc : '',
      avatarUrl: c.avatar || '',
    })
    try { audio?.pause() } catch (_) {}
    window.agentsChat?.channelCreated?.(profile, own
      ? { niche: n, script: makeNow ? { text: c.ownText, title: c.ownTitle } : null, firstTopic: '' }
      : { niche: n, topic: makeNow ? c.topic.trim() : '', firstTopic: c.topic.trim() })
    c = fresh()
    screen = 'hero'
    from = ''
    saveDraft() // the channel is made: nothing to resume
    try { window.switchPanel?.('agents', document.getElementById('nav-agents')) } catch (_) {}
  }

  function bind() {
    const about = root.querySelector('#cc-about')
    about?.addEventListener('input', () => { c.about = about.value; const nx = root.querySelector('[data-cc-next]'); if (nx) nx.disabled = c.about.trim().length < 3 })
    about?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.stopPropagation(); root.querySelector('[data-cc-about-form]')?.requestSubmit() } })
    root.querySelector('[data-cc-about-form]')?.addEventListener('submit', (e) => { e.preventDefault(); if (c.about.trim().length >= 3 && !busy) toTopic() })
    root.querySelectorAll('[data-cc-niche]').forEach((b) => b.addEventListener('click', () => {
      const n = nicheById(b.dataset.ccNiche)
      if (!n) return
      c.nicheId = n.id
      c.about = 'Channel about ' + n.name.toLowerCase()
      c.genre = ({ history: 'history', military: 'history', crime: 'mystery', space: 'documentary', geography: 'documentary', business: 'storytelling' })[n.id] || 'education'
      render()
    }))
    root.querySelectorAll('[data-cc-cat]').forEach((b) => b.addEventListener('click', () => {
      c.about = root.querySelector('#cc-about')?.value ?? c.about
      c.genre = b.dataset.ccCat
      c.genrePicked = true
      c.nicheId = ''
      if (screen === 'hero') {
        root.querySelectorAll('[data-cc-cat]').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', String(on)) })
        const ta = root.querySelector('#cc-about')
        if (ta) ta.placeholder = (HERO_CATS.find((x) => x.id === heroCat()) || HERO_CATS[0]).idea
        banner()
        saveDraft()
        ta?.focus()
        return
      }
      render()
      root.querySelector('#cc-about')?.focus()
    }))
    root.querySelector('[data-cc-auto]')?.addEventListener('click', () => {
      if (autoBusy) return
      const list = HERO_IDEAS[heroCat()] || HERO_IDEAS.education
      let text = list[Math.floor(Math.random() * list.length)]
      if (text === c.about && list.length > 1) text = list[(list.indexOf(text) + 1) % list.length]
      autoBusy = true
      c.genre = heroCat()
      render()
      setTimeout(() => {
        const box = root.querySelector('#cc-about')
        let i = 0
        const step = () => {
          i++
          c.about = text.slice(0, i)
          if (box) box.value = c.about
          if (i < text.length) return setTimeout(step, 16)
          autoBusy = false
          render()
          root.querySelector('#cc-about')?.focus()
        }
        step()
      }, 650)
    })
    root.querySelector('[data-cc-ref-open]')?.addEventListener('click', () => { c.about = root.querySelector('#cc-about')?.value ?? c.about; refOpen = !refOpen; refErr = ''; render(); root.querySelector('[data-cc-ref-in]')?.focus() })
    root.querySelector('[data-cc-ref-close]')?.addEventListener('click', () => { refOpen = false; refErr = ''; render() })
    root.querySelector('[data-cc-ref-clear]')?.addEventListener('click', () => { c.reference = null; render() })
    const refIn = root.querySelector('[data-cc-ref-in]')
    const readRef = async () => {
      const url = refIn?.value.trim()
      if (!url) return
      refBusy = true; refErr = ''; render()
      const box = root.querySelector('[data-cc-ref-in]'); if (box) box.value = url
      try {
        const out = await window.fvReadReference?.(url)
        if (!out?.about) throw new Error('Could not read that channel.')
        c.reference = { title: out.channel?.title || '', summary: out.summary || '', titles: out.channel?.titles || [] }
        c.about = out.about
        c.genre = out.genre || c.genre
        c.nicheId = out.niche || ''
        if (out.angle && out.angle !== 'auto') c.angle = out.angle
        refOpen = false
      } catch (e) { refErr = e?.message || 'Could not read that channel.' }
      refBusy = false
      render()
    }
    root.querySelector('[data-cc-ref-go]')?.addEventListener('click', readRef)
    refIn?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); readRef() } })
    root.querySelector('[data-cc-skip]')?.addEventListener('click', () => { window.agentsChat?.channelSkipped?.(); try { window.switchPanel?.('agents', document.getElementById('nav-agents')) } catch (_) {} })
    root.querySelector('[data-cc-leave]')?.addEventListener('click', () => { const to = from; from = ''; try { window.switchPanel?.(to || 'agents') } catch (_) {} })
    root.querySelector('[data-cc-hero]')?.addEventListener('click', () => { screen = 'hero'; render() })
    root.querySelector('[data-cc-name-pen]')?.addEventListener('click', () => { const el = root.querySelector('[data-cc-name]'); if (el) { el.focus(); el.select() } })
    root.querySelector('[data-cc-ava-file]')?.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0]
      if (!f || !/^image\//.test(f.type)) return
      const url = URL.createObjectURL(f)
      const img = new Image()
      img.onload = () => {
        // Square-crop to 256 px so it stays small enough to keep with the profile.
        const n = 256, cv = document.createElement('canvas'); cv.width = cv.height = n
        const side = Math.min(img.naturalWidth, img.naturalHeight)
        cv.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, n, n)
        c.avatar = cv.toDataURL('image/jpeg', 0.86)
        URL.revokeObjectURL(url)
        render()
      }
      img.src = url
    })
    const name = root.querySelector('[data-cc-name]')
    name?.addEventListener('input', () => { c.name = name.value })
    const topicIn = root.querySelector('[data-cc-topic-in]')
    topicIn?.addEventListener('input', () => {
      c.topic = topicIn.value
      root.querySelectorAll('[data-cc-topic]').forEach((b) => { const on = b.dataset.ccTopic === c.topic; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); b.querySelector('i').textContent = on ? '✓' : '' })
      const nx = root.querySelector('[data-cc-next-step]'); if (nx) nx.disabled = c.topic.trim().length < 4
    })
    root.querySelectorAll('[data-cc-topic]').forEach((b) => b.addEventListener('click', () => { c.topic = b.dataset.ccTopic; render() }))
    root.querySelector('[data-cc-regen]')?.addEventListener('click', async () => { c.topic = ''; await suggest(); render() })
    root.querySelectorAll('[data-cc-aspect]').forEach((b) => b.addEventListener('click', () => { c.aspect = b.dataset.ccAspect; render() }))
    root.querySelectorAll('[data-cc-len]').forEach((b) => b.addEventListener('click', () => { c.durationId = b.dataset.ccLen; render() }))
    root.querySelectorAll('[data-cc-len-locked]').forEach((b) => b.addEventListener('click', () => { try { window.openPaywall?.({ force: true, reason: 'upgrade' }) } catch (_) {} }))
    root.querySelectorAll('[data-cc-style]').forEach((b) => b.addEventListener('click', () => {
      c.style = b.dataset.ccStyle
      // Update in place so the search, group filter and scroll stay put.
      root.querySelectorAll('[data-cc-style]').forEach((x) => {
        const on = x === b
        x.classList.toggle('is-on', on)
        x.setAttribute('aria-checked', String(on))
        x.querySelector('.cc-check')?.remove()
        if (on) x.insertAdjacentHTML('beforeend', '<span class="cc-check" aria-hidden="true">✓</span>')
      })
      const next = root.querySelector('[data-cc-next-step]')
      if (next) next.disabled = false
    }))
    root.querySelectorAll('[data-cc-mode]').forEach((b) => b.addEventListener('click', () => { c.scriptMode = b.dataset.ccMode; render() }))
    root.querySelectorAll('[data-cc-angle]').forEach((b) => b.addEventListener('click', () => { c.angle = b.dataset.ccAngle; render() }))
    root.querySelector('[data-cc-own-title]')?.addEventListener('input', (e) => { c.ownTitle = e.target.value })
    const ownText = root.querySelector('[data-cc-own-text]')
    ownText?.addEventListener('input', () => {
      c.ownText = ownText.value
      const est = scriptEstimate(c.ownText)
      const lab = root.querySelector('[data-cc-est]'); if (lab) lab.textContent = est.label || 'At least 40 words. Length follows your script.'
      const nx = root.querySelector('[data-cc-next-step]'); if (nx) nx.disabled = est.words < 40
    })
    root.querySelectorAll('[data-cc-vmode]').forEach((b) => b.addEventListener('click', () => { c.mode = b.dataset.ccVmode; render() }))
    root.querySelectorAll('[data-cc-pace]').forEach((b) => b.addEventListener('click', () => { c.pace = b.dataset.ccPace; render() }))
    root.querySelectorAll('[data-cc-cap]').forEach((b) => b.addEventListener('click', () => { c.captions = b.dataset.ccCap; render() }))
    root.querySelector('[data-cc-char-clear]')?.addEventListener('click', () => { c.charUrl = ''; render() })
    root.querySelector('[data-cc-char-form]')?.addEventListener('submit', async (e) => {
      e.preventDefault()
      c.charDesc = root.querySelector('#cc-char')?.value.trim() || ''
      if (!c.charDesc) return
      charBusy = true; charErr = ''; render()
      try {
        // The character is drawn in the chosen style, so set it first.
        window.fvSetVisual?.({ style: c.style })
        c.charUrl = await window.fvCreateCharacter?.(c.charDesc) || ''
      } catch (err) { charErr = /live app|not found|405|404|sign/i.test(err?.message || '') ? 'Characters are drawn once you are signed in. You can add one later under Channels.' : (err?.message || 'Could not draw the character.') }
      charBusy = false; render()
    })
    root.querySelector('[data-cc-style-q]')?.addEventListener('input', filterStyles)
    root.querySelectorAll('[data-cc-group]').forEach((b) => b.addEventListener('click', () => { root.querySelectorAll('[data-cc-group]').forEach((x) => x.classList.toggle('is-on', x === b)); filterStyles() }))
    root.querySelectorAll('[data-cc-voice]').forEach((el) => {
      const pick = () => { c.voiceId = el.dataset.ccVoice; render() }
      el.addEventListener('click', pick)
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick() } })
    })
    root.querySelectorAll('[data-cc-play]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); play(b.dataset.ccPlay, b.dataset.id) }))
    root.querySelector('[data-cc-next-step]')?.addEventListener('click', () => {
      const i = CREATOR_STEPS.findIndex((x) => x.id === screen)
      screen = CREATOR_STEPS[i + 1].id
      if (screen === 'voice') { try { window.fvAgentsLoadVoices?.() } catch (_) {} }
      if (screen === 'captions' && !c.captions) c.captions = genreById(c.genre)?.captions || ''
      render()
      root.closest('.panel')?.scrollTo?.(0, 0)
    })
    root.querySelector('[data-cc-back]')?.addEventListener('click', () => {
      const i = CREATOR_STEPS.findIndex((x) => x.id === screen)
      screen = i > 0 ? CREATOR_STEPS[i - 1].id : 'hero'
      render()
    })
    root.querySelectorAll('[data-cc-step]').forEach((b) => b.addEventListener('click', () => { screen = b.dataset.ccStep; render() }))
    root.querySelectorAll('[data-cc-finish]').forEach((b) => b.addEventListener('click', () => finish(b.dataset.ccFinish === 'make' && c.topic.trim().length >= 4)))
  }

  /** A topic typed on the public landing page ("/") before sign-up: fill it in and start the Manager. */
  async function takeLanding() {
    let x = null
    try { x = JSON.parse(localStorage.getItem('vidso_landing_topic') || 'null'); localStorage.removeItem('vidso_landing_topic') } catch (_) {}
    const text = String(x?.about || '').trim().slice(0, 300)
    if (!x || Date.now() - (x.t || 0) > 864e5 || text.length < 3) return false
    // Straight to "New channel" with the topics loading: never flash the start screen.
    c = fresh(); screen = 'topic'; c.about = text; busy = true
    if (x.cat && BANNER[x.cat]) c.genre = x.cat // the channel type picked on the landing page
    const url = String(x.ref || '').trim()
    if (url && window.fvReadReference) {
      refBusy = true; render()
      try {
        const out = await window.fvReadReference(url)
        if (out?.about) {
          c.reference = { title: out.channel?.title || '', summary: out.summary || '', titles: out.channel?.titles || [] }
          c.genre = out.genre || c.genre
          c.nicheId = out.niche || ''
          if (out.angle && out.angle !== 'auto') c.angle = out.angle
        }
      } catch (_) {}
      refBusy = false
    }
    render()
    toTopic()
    return true
  }

  window.addEventListener('vidso:plan-active', () => {
    if (!waitingForPlan) return
    waitingForPlan = false
    finish(c.topic.trim().length >= 4)
  })

  // Arriving from the landing page (right after sign-up): open on the loading channel page,
  // not the start screen, until takeLanding() picks the topic up.
  let landingWaiting = false
  try {
    const x = JSON.parse(localStorage.getItem('vidso_landing_topic') || 'null')
    if (x && Date.now() - (x.t || 0) <= 864e5 && String(x.about || '').trim().length >= 3) { c.about = String(x.about).trim().slice(0, 300); screen = 'topic'; busy = true; landingWaiting = true }
  } catch (_) {}
  // Otherwise pick up a setup that was in progress (a refresh mid-way).
  let resumeTopics = false
  if (!landingWaiting) {
    const d = readDraft()
    if (d) {
      c = { ...fresh(), ...d.c }
      screen = d.screen
      resumeTopics = screen === 'topic' && !(c.topics && c.topics.length) && c.scriptMode !== 'own'
    }
  }

  window.addEventListener('vidso:agents', () => {
    // Voices arrive after load: refresh only the narrator screen.
    if (screen === 'voice' && root.closest('.panel')?.classList.contains('active')) render()
  })
  // Some picks update the page in place without a re-render: save after any click or typing too.
  let saveT = 0
  const queueSave = () => { clearTimeout(saveT); saveT = setTimeout(saveDraft, 150) }
  root.addEventListener('click', queueSave)
  root.addEventListener('input', queueSave)
  render()
  if (resumeTopics) toTopic()
  return {
    render,
    /** Start fresh. `back` is the panel to return to on "Not now" ('' for first run). */
    open: (back = '') => { c = fresh(); screen = 'hero'; from = back; render(); takeLanding() },
    takeLanding,
    /** True while a setup is under way (past the start screen), so callers don't reset it. */
    inProgress: () => screen !== 'hero',
  }
}
