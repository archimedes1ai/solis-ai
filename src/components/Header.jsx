const MODE_LABEL = { idle:'STANDBY', listening:'LISTENING', thinking:'PROCESSING', speaking:'SPEAKING', agents:'AGENTS ACTIVE', meeting:'MEETING MODE' };
const MODE_COLOR = { idle:'#00d4ff', listening:'#00ff88', thinking:'#ffcc00', speaking:'#bf80ff', agents:'#ff6b35', meeting:'#ff4466' };

export default function Header({ uiState, project, time, statusText, meetingMode, wakeArmed }) {
  const fmtT = d => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const fmtD = d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  const mode = meetingMode ? 'meeting' : uiState;
  const col  = MODE_COLOR[mode] || MODE_COLOR.idle;

  return (
    <header className={`hdr${meetingMode ? ' hdr--meet' : ''}`}>
      <div className="hdr__left">
        <div className="hdr__brand">
          <span className="hdr__name">SOLIS</span>
          <span className="hdr__tag">Construction Intelligence Assistant</span>
        </div>
        {project && (
          <div className="hdr__project">
            <div className="hdr__proj-lbl">PROJECT</div>
            <div className="hdr__proj-name">{project.name.toUpperCase()}</div>
          </div>
        )}
      </div>

      <div className="hdr__mid">
        <div className="hdr__mode" style={{ color: col, borderColor: col }}>
          <span className="hdr__mode-dot" style={{ background: col }} />
          {MODE_LABEL[mode] || 'STANDBY'}
          {wakeArmed && !meetingMode && <span className="hdr__wake">⚡ HEY SOLIS</span>}
        </div>
      </div>

      <div className="hdr__right">
        <div className="hdr__clock">
          <div className="hdr__time" style={{ fontVariantNumeric: 'tabular-nums', minWidth: '7ch' }}>{fmtT(time)}</div>
          <div className="hdr__date">{fmtD(time)}</div>
        </div>
        <div className="hdr__dot" title="Connected" />
      </div>
    </header>
  );
}
