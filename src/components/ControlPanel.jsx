import { LIFECYCLE_STAGES, AGENTS } from '../utils/constants.js';

export default function ControlPanel({
  uiState, activeAgents, lifecycleStage, setLifecycleStage,
  meetingMode, toggleMeeting, wakeEnabled, toggleWake, wakeArmed,
  voiceOut, setVoiceOut, onWhatAmIMissing, statusText, speechSupported,
}) {
  const stageIdx    = LIFECYCLE_STAGES.findIndex(s => s.id === lifecycleStage);
  const runningAgents = activeAgents.filter(a => a.status === 'running');

  return (
    <div className="ctrl">

      <div className="ctrl__section">
        <div className="ctrl__title">SYSTEM STATUS</div>
        <div className="ctrl__status">
          {[
            ['STATUS', statusText],
            ['MODE',   meetingMode ? 'MEETING' : uiState === 'agents' ? `${activeAgents.length} AGENTS` : uiState.toUpperCase()],
            ['STAGE',  LIFECYCLE_STAGES.find(s => s.id === lifecycleStage)?.short || '—'],
            ['AGENTS', activeAgents.length ? `${activeAgents.filter(a => a.status === 'done').length}/${activeAgents.length} DONE` : 'STANDBY'],
          ].map(([l, v]) => (
            <div key={l} className="ctrl__stat">
              <span className="ctrl__stat-lbl">{l}</span>
              <span className={`ctrl__stat-val${statusText.includes('ERROR') && l === 'STATUS' ? ' ctrl__stat-val--err' : ''}`}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <button className="ctrl__btn ctrl__btn--missing" onClick={onWhatAmIMissing}>
        🔍 WHAT AM I MISSING?
      </button>

      {activeAgents.length > 0 && (
        <div className="ctrl__section">
          <div className="ctrl__title">ACTIVE AGENTS ({runningAgents.length} RUNNING)</div>
          {activeAgents.map(a => (
            <div key={a.id} className={`ctrl__agent${a.status === 'done' ? ' ctrl__agent--done' : ''}`}>
              <span className="ctrl__agent-icon">{a.icon}</span>
              <span className="ctrl__agent-name" style={{ color: a.colour }}>{a.name}</span>
              <span className={`ctrl__agent-dot ctrl__agent-dot--${a.status === 'done' ? 'done' : 'run'}`}>
                {a.status === 'done' ? '✓' : '●'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="ctrl__section">
        <div className="ctrl__title">CONTROLS</div>

        <button
          className={`ctrl__btn${meetingMode ? ' ctrl__btn--meet-on' : ' ctrl__btn--meet'}`}
          onClick={toggleMeeting}
        >
          {meetingMode ? '⏹' : '🎙'} {meetingMode ? 'END MEETING' : 'MEETING MODE'}
        </button>

        {speechSupported && (
          <button
            className={`ctrl__btn${wakeEnabled ? (wakeArmed ? ' ctrl__btn--wake-arm' : ' ctrl__btn--wake-on') : ' ctrl__btn--wake-off'}`}
            onClick={toggleWake}
          >
            {wakeEnabled ? '🔊' : '🔇'} {wakeEnabled ? (wakeArmed ? '"HEY SOLIS" ARMED' : '"HEY SOLIS" ON') : '"HEY SOLIS" OFF'}
          </button>
        )}

        <div className="ctrl__toggle">
          <span className="ctrl__toggle-lbl">VOICE OUTPUT</span>
          <button className={`ctrl__toggle-btn${voiceOut ? ' ctrl__toggle-btn--on' : ''}`} onClick={setVoiceOut}>
            {voiceOut ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="ctrl__section">
        <div className="ctrl__title">PROJECT LIFECYCLE — {LIFECYCLE_STAGES.length} STAGES</div>
        <div className="ctrl__life">
          {LIFECYCLE_STAGES.map((s, i) => (
            <button
              key={s.id}
              className={`ctrl__stage${lifecycleStage === s.id ? ' ctrl__stage--active' : ''}${i < stageIdx ? ' ctrl__stage--done' : ''}`}
              onClick={() => setLifecycleStage(s.id)}
              title={s.label}
            >
              <span className="ctrl__stage-ico">{i < stageIdx ? '✓' : s.icon}</span>
              <span className="ctrl__stage-lbl">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ctrl__section">
        <div className="ctrl__title">AGENT REGISTRY — {AGENTS.length} AGENTS</div>
        <div className="ctrl__agents-grid">
          {AGENTS.map(a => (
            <div key={a.id} className="ctrl__agent-chip" title={a.name}>
              <span>{a.icon}</span>
              <span className="ctrl__agent-chip-name" style={{ color: a.colour }}>{a.name}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
