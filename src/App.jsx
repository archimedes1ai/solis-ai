import { useState, useRef, useEffect, useCallback } from 'react';
import Header       from './components/Header.jsx';
import ChatPanel    from './components/ChatPanel.jsx';
import BrainCanvas  from './components/BrainCanvas.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import { callSolis } from './utils/apiClient.js';
import { dispatchAgents, getAgentById } from './utils/dispatcher.js';

const SR_SUPPORTED = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
const IS_MOBILE    = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
// Matches "hey solis", "hi solis", "ok solis", bare "solis", etc.
const WAKE_RE      = /\b(hey\s+solis|hello\s+solis|ok\s+solis|hi\s+solis|oi\s+solis|solis)\b/i;

export default function App() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [messages,       setMessages]       = useState([]);
  const [input,          setInput]          = useState('');
  const [transcript,     setTranscript]     = useState('');
  const [uiState,        setUiState]        = useState('idle');
  const [activeAgents,   setActiveAgents]   = useState([]);
  const [attachments,    setAttachments]    = useState([]);
  const [error,          setError]          = useState('');
  const [time,           setTime]           = useState(new Date());
  const [statusText,     setStatusText]     = useState('READY');
  const [lifecycleStage, setLifecycleStage] = useState('enquiry');
  const [currentProject, setCurrentProject] = useState(null);  // eslint-disable-line
  const [meetingMode,    setMeetingMode]    = useState(false);
  const [voiceOut,       setVoiceOut]       = useState(!IS_MOBILE);
  const [wakeEnabled,    setWakeEnabled]    = useState(false);
  const [wakeArmed,      setWakeArmed]      = useState(false);
  const [wakeFlash,      setWakeFlash]      = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const inputRef      = useRef(null);
  const chatEndRef    = useRef(null);
  const fileInputRef  = useRef(null);
  const recRef        = useRef(null);
  const wakeRecRef    = useRef(null);
  const meetRecRef    = useRef(null);
  const synthRef      = useRef(window.speechSynthesis);
  const voicesRef     = useRef([]);
  // Synchronous flag — set true the moment ANY listening starts, before React flushes state.
  // Guards startWake() so it never steals the mic while voice input is active.
  const listeningRef  = useRef(false);

  // Mirror volatile state into refs so async handlers always read current values
  const uiRef        = useRef(uiState);
  const wakeEnRef    = useRef(wakeEnabled);
  const meetRef      = useRef(meetingMode);
  const msgsRef      = useRef(messages);
  const voiceOutRef  = useRef(voiceOut);
  const sendRef      = useRef(null);

  uiRef.current       = uiState;
  wakeEnRef.current   = wakeEnabled;
  meetRef.current     = meetingMode;
  msgsRef.current     = messages;
  voiceOutRef.current = voiceOut;

  // ── Clock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── TTS voices ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = () => { voicesRef.current = synthRef.current.getVoices(); };
    load();
    synthRef.current.addEventListener('voiceschanged', load);
    return () => synthRef.current.removeEventListener('voiceschanged', load);
  }, []);

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, transcript]);

  // ── TTS speak ─────────────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!voiceOutRef.current || !text) return;
    synthRef.current.cancel();
    const clean = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^[⚠️•●▸►#]+\s*/gm, '').slice(0, 900);
    const utt   = new SpeechSynthesisUtterance(clean);
    const vs    = voicesRef.current;
    const pref  = vs.find(v => v.lang === 'en-GB' && /daniel|oliver|george|male/i.test(v.name))
               || vs.find(v => v.lang === 'en-GB')
               || vs.find(v => v.lang.startsWith('en'));
    if (pref) utt.voice = pref;
    utt.rate = 0.92; utt.pitch = 0.88;
    utt.onstart = () => { setUiState('speaking'); setStatusText('SPEAKING'); };
    utt.onend   = () => { setUiState('idle');     setStatusText('READY'); };
    utt.onerror = () => { setUiState('idle');     setStatusText('READY'); };
    synthRef.current.speak(utt);
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (textArg) => {
    const raw  = typeof textArg === 'string' ? textArg : input;
    const text = raw.trim();
    if (!text && attachments.length === 0) return;
    if (uiRef.current !== 'idle' && uiRef.current !== 'listening') return;

    setError(''); setInput(''); setTranscript('');

    const atts = [...attachments];
    setAttachments([]);

    const content = [];
    for (const a of atts) {
      if ((a.isImage || a.isPDF) && a.data) {
        content.push({ type: 'image', source: { type: 'base64', media_type: a.mediaType, data: a.data } });
      } else if (a.content) {
        content.push({ type: 'text', text: `[Attached: ${a.name}]\n${a.content.slice(0, 8000)}` });
      }
    }
    if (text) content.push({ type: 'text', text });

    const msgContent  = content.length === 1 && content[0].type === 'text' ? text : content;
    const displayText = text || atts.map(a => a.name).join(', ');
    const userMsg     = { role: 'user', content: msgContent, displayText, attachments: atts, ts: Date.now() };

    setMessages(prev => [...prev, userMsg]);

    const ids        = dispatchAgents(text, lifecycleStage);
    const dispatched = ids.map(id => getAgentById(id)).filter(Boolean).map(a => ({ ...a, status: 'running' }));

    if (dispatched.length > 0) {
      setActiveAgents(dispatched);
      setUiState('agents');
      setStatusText(`${dispatched.length} AGENT${dispatched.length > 1 ? 'S' : ''} DEPLOYED`);
    } else {
      setUiState('thinking');
      setStatusText('PROCESSING');
    }

    try {
      const history = msgsRef.current.slice(-20).map(m => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: msgContent });

      const stageLbl = lifecycleStage.replace(/-/g, ' ').toUpperCase();
      const ctx      = currentProject
        ? `CURRENT PROJECT: ${currentProject.name}\nSTAGE: ${stageLbl}`
        : `LIFECYCLE STAGE: ${stageLbl}`;
      const agentCtx = dispatched.length > 0
        ? `\nACTIVE AGENTS: ${dispatched.map(a => a.name).join(', ')}\nApply these agents' expertise in your response.`
        : '';

      const reply = await callSolis({ messages: history, system: ctx + agentCtx, maxTokens: 2500 });

      setMessages(prev => [...prev, {
        role: 'assistant', content: reply,
        agents: dispatched.map(a => a.name), ts: Date.now(),
      }]);
      setActiveAgents(prev => prev.map(a => ({ ...a, status: 'done' })));
      setTimeout(() => setActiveAgents([]), 4000);
      setUiState('idle');
      setStatusText('READY');
      speak(reply);

    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${e.message}`, ts: Date.now(), isError: true }]);
      setActiveAgents([]);
      setUiState('idle');
      setStatusText('ERROR');
      setError(e.message);
    }
  }, [input, attachments, lifecycleStage, currentProject, speak]);

  sendRef.current = sendMessage;

  // ── Voice input ───────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recRef.current?.stop();
    listeningRef.current = false;
    setUiState('idle'); setStatusText('READY');
  }, []);

  const startListening = useCallback(() => {
    if (!SR_SUPPORTED || uiRef.current !== 'idle') return;
    // Set synchronously so wake word guard sees it before React flushes uiState
    listeningRef.current = true;
    setError('');
    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'en-GB'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;

    rec.onstart  = () => { setUiState('listening'); setStatusText('LISTENING...'); setTranscript(''); };
    rec.onresult = (e) => {
      const tx = Array.from(e.results).map(r => r[0].transcript).join('');
      setTranscript(tx);
      if (e.results[e.results.length - 1].isFinal) {
        rec.stop(); setTranscript(''); setUiState('idle');
        listeningRef.current = false;
        sendRef.current(tx);
      }
    };
    rec.onerror = (e) => {
      listeningRef.current = false;
      setUiState('idle'); setTranscript('');
      if (e.error === 'not-allowed') setError('Microphone denied — allow in browser settings.');
      else if (e.error !== 'no-speech') setError(`Voice error: ${e.error}`);
      setStatusText('READY');
    };
    rec.onend = () => {
      listeningRef.current = false;
      if (uiRef.current === 'listening') { setUiState('idle'); setStatusText('READY'); }
    };

    recRef.current = rec;
    try { rec.start(); } catch (e) { listeningRef.current = false; setError('Mic error: ' + e.message); }
  }, []);

  // ── Wake word ─────────────────────────────────────────────────────────────
  const stopWake = useCallback(() => {
    console.log('[SOLIS wake] stopWake — aborting recognition');
    if (wakeRecRef.current) {
      try { wakeRecRef.current.abort(); } catch (err) { console.log('[SOLIS wake] abort error:', err.message); }
      wakeRecRef.current = null;
    }
    setWakeArmed(false);
  }, []);

  const startWake = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR)                    { console.log('[SOLIS wake] SpeechRecognition not supported'); return; }
    if (!wakeEnRef.current)     { console.log('[SOLIS wake] skipped — wake disabled');         return; }
    if (wakeRecRef.current)     { console.log('[SOLIS wake] skipped — already running');        return; }
    if (meetRef.current)        { console.log('[SOLIS wake] skipped — meeting mode');           return; }
    if (listeningRef.current)   { console.log('[SOLIS wake] skipped — mic in use (listeningRef)'); return; }
    // Belt-and-suspenders: also check uiState for speaking/thinking
    if (uiRef.current !== 'idle') { console.log('[SOLIS wake] skipped — uiState:', uiRef.current); return; }

    console.log('[SOLIS wake] Creating recogniser…');
    const rec = new SR();
    rec.lang = 'en-GB'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 3;

    rec.onstart = () => {
      console.log('[SOLIS wake] Armed — listening for "Hey SOLIS"');
      setWakeArmed(true);
    };

    rec.onresult = (e) => {
      const latest = e.results[e.results.length - 1];
      // Log every heard phrase so we can confirm speech recognition is firing at all
      const alts = Array.from({ length: latest.length }, (_, i) => latest[i].transcript);
      console.log('[SOLIS wake] Heard:', alts.join(' | '), latest.isFinal ? '(final)' : '(interim)');

      if (uiRef.current !== 'idle') return;

      for (let i = 0; i < latest.length; i++) {
        if (WAKE_RE.test(latest[i].transcript)) {
          console.log('[SOLIS wake] WAKE WORD MATCHED:', latest[i].transcript);
          setWakeFlash(true); setTimeout(() => setWakeFlash(false), 900);
          stopWake();
          // 400 ms lets abort() fully settle and its onend fire before we claim the mic
          setTimeout(() => { synthRef.current.cancel(); startListening(); }, 400);
          return;
        }
      }
    };

    rec.onerror = (e) => {
      console.log('[SOLIS wake] Error:', e.error);
      wakeRecRef.current = null; setWakeArmed(false);
      // not-allowed means mic permission denied — don't retry, it won't help
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        console.log('[SOLIS wake] Mic permission denied — stopping wake word');
        return;
      }
      // Retry other transient errors (aborted, network) after a pause
      if (wakeEnRef.current) {
        console.log('[SOLIS wake] Retrying in 1 s…');
        setTimeout(() => { if (wakeEnRef.current && !wakeRecRef.current) startWake(); }, 1000);
      }
    };

    rec.onend = () => {
      console.log('[SOLIS wake] Recognition ended (wakeEnabled:', wakeEnRef.current, 'uiState:', uiRef.current, ')');
      wakeRecRef.current = null; setWakeArmed(false);
      // Re-arm only when idle and still enabled — mic permission is already granted so
      // no new user gesture is required for subsequent start() calls
      // 800 ms — gives startListening() time to set listeningRef and claim the mic
      if (wakeEnRef.current && !meetRef.current) {
        console.log('[SOLIS wake] Re-arming in 800 ms…');
        setTimeout(() => {
          if (wakeEnRef.current && !wakeRecRef.current && !listeningRef.current && uiRef.current === 'idle') startWake();
        }, 800);
      }
    };

    wakeRecRef.current = rec;
    console.log('[SOLIS wake] Calling rec.start()…');
    try {
      rec.start();
    } catch (err) {
      console.log('[SOLIS wake] rec.start() threw:', err.message);
      wakeRecRef.current = null; setWakeArmed(false);
    }
  }, [stopWake, startListening]);

  // Re-arm when returning to idle after a query (the onend path doesn't cover this because
  // the recogniser was already stopped before the query ran)
  useEffect(() => {
    if (uiState === 'idle' && wakeEnabled && !wakeArmed && !wakeRecRef.current && !meetingMode) {
      console.log('[SOLIS wake] useEffect: idle+enabled — scheduling re-arm');
      const t = setTimeout(() => {
        if (wakeEnRef.current && !wakeRecRef.current && uiRef.current === 'idle') startWake();
      }, 700);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState, wakeEnabled, meetingMode]);

  // Toggle — onClick fires synchronously within a user gesture, satisfying the browser's
  // requirement that the first SpeechRecognition.start() call comes from user interaction.
  const toggleWake = useCallback(() => {
    const next = !wakeEnabled;
    console.log('[SOLIS wake] toggleWake — next:', next);
    setWakeEnabled(next); wakeEnRef.current = next;
    if (next) {
      startWake(); // called directly inside click handler — user gesture requirement satisfied
      setStatusText('HEY SOLIS — ARMED');
    } else {
      stopWake();
      setStatusText('WAKE WORD OFF');
      setTimeout(() => setStatusText('READY'), 2000);
    }
  }, [wakeEnabled, startWake, stopWake]);

  // ── Meeting mode ──────────────────────────────────────────────────────────
  const stopMeetListening = useCallback(() => {
    console.log('[SOLIS meet] stopMeetListening');
    if (meetRecRef.current) {
      try { meetRecRef.current.abort(); } catch {}
      meetRecRef.current = null;
    }
    listeningRef.current = false;
  }, []);

  const startMeetListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR)                   { console.log('[SOLIS meet] SpeechRecognition not supported'); return; }
    if (!meetRef.current)      { console.log('[SOLIS meet] skipped — meeting mode off');      return; }
    if (meetRecRef.current)    { console.log('[SOLIS meet] skipped — already running');        return; }
    if (uiRef.current !== 'idle') { console.log('[SOLIS meet] skipped — uiState:', uiRef.current); return; }

    console.log('[SOLIS meet] Starting meeting recognition…');
    listeningRef.current = true;

    const rec = new SR();
    rec.lang = 'en-GB'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;

    rec.onstart = () => {
      console.log('[SOLIS meet] Listening…');
      setUiState('listening');
      setStatusText('MEETING — LISTENING…');
      setTranscript('');
    };

    rec.onresult = (e) => {
      const tx = Array.from(e.results).map(r => r[0].transcript).join('');
      setTranscript(tx);
      console.log('[SOLIS meet] Heard:', tx, e.results[e.results.length - 1].isFinal ? '(final)' : '(interim)');
      if (e.results[e.results.length - 1].isFinal) {
        console.log('[SOLIS meet] Final — sending:', tx);
        meetRecRef.current = null;
        rec.stop();
        setTranscript('');
        // uiRef.current is still 'listening' here — sendMessage allows that
        if (tx.trim()) sendRef.current(tx);
        else { listeningRef.current = false; setUiState('idle'); }
      }
    };

    rec.onerror = (e) => {
      console.log('[SOLIS meet] Error:', e.error);
      meetRecRef.current = null;
      listeningRef.current = false;
      setUiState('idle'); setTranscript('');
      if (e.error === 'not-allowed') {
        setError('Microphone denied — allow in browser settings.');
        return;
      }
      // Restart on no-speech (silence) so meeting keeps listening
      if (meetRef.current && e.error === 'no-speech') {
        console.log('[SOLIS meet] No speech — restarting…');
        setTimeout(() => {
          if (meetRef.current && !meetRecRef.current && uiRef.current === 'idle') startMeetListening();
        }, 400);
      }
    };

    rec.onend = () => {
      console.log('[SOLIS meet] onend — uiState:', uiRef.current, 'meetingMode:', meetRef.current);
      meetRecRef.current = null;
      listeningRef.current = false;
      // If we ended mid-listen without a final result (e.g. abort), clean up
      if (uiRef.current === 'listening') { setUiState('idle'); }
      // Restart only if meeting still active and we're back to idle (useEffect also handles this)
      if (meetRef.current && uiRef.current === 'idle') {
        console.log('[SOLIS meet] onend restart in 600 ms…');
        setTimeout(() => {
          if (meetRef.current && !meetRecRef.current && uiRef.current === 'idle') startMeetListening();
        }, 600);
      }
    };

    meetRecRef.current = rec;
    try {
      rec.start();
    } catch (err) {
      console.log('[SOLIS meet] rec.start() threw:', err.message);
      meetRecRef.current = null;
      listeningRef.current = false;
    }
  }, []);

  // Restart meeting listening after SOLIS finishes responding
  useEffect(() => {
    if (uiState === 'idle' && meetingMode && !meetRecRef.current) {
      console.log('[SOLIS meet] useEffect: idle in meeting mode — restarting in 800 ms');
      const t = setTimeout(() => {
        if (meetRef.current && !meetRecRef.current && uiRef.current === 'idle') startMeetListening();
      }, 800);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState, meetingMode]);

  // toggleMeeting — onClick is a user gesture; startMeetListening() called directly
  // to satisfy the browser's requirement for SpeechRecognition.start()
  const toggleMeeting = useCallback(() => {
    const next = !meetingMode;
    console.log('[SOLIS meet] toggleMeeting — next:', next);
    setMeetingMode(next); meetRef.current = next;
    if (next) {
      stopWake();          // wake word and meeting can't share the mic
      startMeetListening(); // called directly inside click handler — user gesture ✓
      setStatusText('MEETING — LISTENING…');
    } else {
      stopMeetListening();
      setUiState('idle');
      setStatusText('MEETING MODE OFF');
      setTimeout(() => setStatusText('READY'), 2000);
    }
  }, [meetingMode, stopWake, startMeetListening, stopMeetListening]);

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFiles = useCallback(async (files) => {
    setError('');
    const next = [];
    for (const f of Array.from(files)) {
      if (f.size > 20 * 1024 * 1024) { setError(`${f.name} exceeds 20 MB.`); continue; }
      const mt      = f.type || 'application/octet-stream';
      const isImage = mt.startsWith('image/');
      const isPDF   = mt === 'application/pdf';
      const isText  = mt.startsWith('text/') || mt === 'application/json' || /\.(csv|json|txt)$/i.test(f.name);
      try {
        const data    = isText ? null : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
        const content = isText ? await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f); }) : null;
        next.push({ id: Date.now() + Math.random(), name: f.name, mediaType: mt, data, content, isImage, isPDF, isText });
      } catch { setError(`Could not read ${f.name}.`); }
    }
    setAttachments(prev => [...prev, ...next]);
  }, []);

  // ── What am I missing ─────────────────────────────────────────────────────
  const handleMissing = useCallback(() => {
    const stage  = lifecycleStage.replace(/-/g, ' ');
    const prompt = currentProject
      ? `Project "${currentProject.name}" is at ${stage} stage. What am I missing? Check comprehensively: contract details, notices, programme, RAMS, payment evidence, variations, reports, photos, outstanding actions, compliance, risks and overdue obligations. Prioritise by urgency.`
      : `I am at ${stage} stage. What am I missing? Give me a thorough checklist of what needs to be in place, obligations due, risks present, and immediate priority actions.`;
    sendRef.current(prompt);
  }, [currentProject, lifecycleStage]);

  // ── Voice output toggle ───────────────────────────────────────────────────
  const toggleVoiceOut = useCallback(() => {
    setVoiceOut(v => { voiceOutRef.current = !v; return !v; });
    synthRef.current.cancel();
    if (uiState === 'speaking') setUiState('idle');
  }, [uiState]);

  const micActive   = uiState === 'listening';
  const micDisabled = uiState !== 'idle' && uiState !== 'listening';

  return (
    <div className={`app${meetingMode ? ' app--meet' : ''}`}>
      <Header
        uiState={uiState}
        project={currentProject}
        time={time}
        statusText={statusText}
        meetingMode={meetingMode}
        wakeArmed={wakeArmed}
      />

      <div className="body">
        <div className="grid">

          <ChatPanel
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={sendMessage}
            transcript={transcript}
            attachments={attachments}
            onAttach={() => fileInputRef.current?.click()}
            onVoice={() => micActive ? stopListening() : startListening()}
            micActive={micActive}
            micDisabled={micDisabled}
            uiState={uiState}
            meetingMode={meetingMode}
            chatEndRef={chatEndRef}
            inputRef={inputRef}
            fileInputRef={fileInputRef}
            onFileChange={handleFiles}
            onRemoveAttachment={id => setAttachments(p => p.filter(a => a.id !== id))}
            speechSupported={SR_SUPPORTED}
            error={error}
          />

          <div className="brain-col">
            <BrainCanvas
              state={uiState}
              meetingMode={meetingMode}
              wakeArmed={wakeArmed}
              wakeFlash={wakeFlash}
              agentCount={activeAgents.filter(a => a.status === 'running').length}
            />
            <div className="brain-lbl">SOLIS · CONSTRUCTION INTELLIGENCE</div>
          </div>

          <ControlPanel
            uiState={uiState}
            activeAgents={activeAgents}
            lifecycleStage={lifecycleStage}
            setLifecycleStage={setLifecycleStage}
            meetingMode={meetingMode}
            toggleMeeting={toggleMeeting}
            wakeEnabled={wakeEnabled}
            toggleWake={toggleWake}
            wakeArmed={wakeArmed}
            voiceOut={voiceOut}
            setVoiceOut={toggleVoiceOut}
            onWhatAmIMissing={handleMissing}
            statusText={statusText}
            speechSupported={SR_SUPPORTED}
          />

        </div>
      </div>
    </div>
  );
}
