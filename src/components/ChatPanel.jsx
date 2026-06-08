import MessageBubble from './MessageBubble.jsx';

// Left column. The <input> lives directly in this component — never inside
// a nested sub-component — so it is stable in the React tree and never
// loses focus when the parent re-renders (e.g. on clock tick).
export default function ChatPanel({
  messages, input, setInput, onSend,
  transcript, attachments, onAttach, onVoice,
  micActive, micDisabled, uiState, meetingMode,
  chatEndRef, inputRef, fileInputRef, onFileChange,
  onRemoveAttachment, speechSupported, error, onClearChat,
}) {
  const busy         = uiState === 'thinking' || uiState === 'uploading';
  const agentsBusy   = uiState === 'agents';
  const inputDisabled = busy || agentsBusy;

  const placeholder = meetingMode
    ? 'Ask SOLIS during meeting...'
    : micActive ? 'Listening...'
    : attachments.length > 0 ? 'Ask about attached files or just send...'
    : 'Ask SOLIS — contracts, QS, programme, disputes, site...';

  return (
    <div
      className="chat"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) onFileChange(e.dataTransfer.files); }}
    >
      <div className="chat__msgs">
        {messages.length === 0 && !transcript && (
          <div className="chat__empty">
            <div className="chat__empty-sun">☀</div>
            <div className="chat__empty-name">SOLIS ONLINE</div>
            <div className="chat__empty-info">
              Construction Intelligence Assistant<br />
              25 specialist agents · 15 lifecycle stages<br />
              Contracts · QS · Programme · Disputes · Site<br />
              Demolition · Asbestos · Civils · Temporary Works<br />
              Ask anything or attach a document to begin
            </div>
          </div>
        )}

        {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}

        {transcript && (
          <div className="msg msg--user">
            <div className="msg__col">
              <div className="msg__body" style={{ opacity: 0.65, fontStyle: 'italic' }}>{transcript}</div>
            </div>
          </div>
        )}

        {busy && (
          <div className="msg msg--solis">
            <div className="msg__avatar">S</div>
            <div className="msg__col">
              <div className="msg__think"><span /><span /><span /></div>
            </div>
          </div>
        )}

        {agentsBusy && (
          <div className="msg msg--solis">
            <div className="msg__avatar">S</div>
            <div className="msg__col">
              <div className="msg__body"><span className="agents-pulse">⚡ Agents deployed — analysing...</span></div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {error && <div className="chat__error">⚠ {error}</div>}

      {attachments.length > 0 && (
        <div className="chat__atts">
          {attachments.map(a => (
            <div key={a.id} className="att-chip">
              <span>📎 {a.name}</span>
              <button onClick={() => onRemoveAttachment(a.id)} aria-label="Remove">×</button>
            </div>
          ))}
        </div>
      )}

      <div className={`chat__bar${meetingMode ? ' chat__bar--meet' : ''}`}>
        {!meetingMode && (
          <button className="chat__bar-icon" onClick={onAttach} title="Attach file">📎</button>
        )}
        {meetingMode && <div className="chat__bar-meet-dot">🔴</div>}

        {/* Hidden file picker */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.json,.xlsx,.xls,.docx,.doc"
          style={{ display: 'none' }}
          onChange={e => onFileChange(e.target.files)}
        />

        {/* Text input — directly here, no wrapping component */}
        <input
          ref={inputRef}
          type="text"
          className="chat__input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={placeholder}
          disabled={inputDisabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        {speechSupported && (
          <button
            className={`chat__voice${micActive ? ' chat__voice--on' : ''}`}
            onClick={onVoice}
            disabled={micDisabled && !micActive}
            title={micActive ? 'Stop' : 'Voice input'}
          >
            {micActive ? '⏹' : '🎙'}
          </button>
        )}

        {messages.length > 0 && (
          <button
            className="chat__clear"
            onClick={() => { if (window.confirm('Clear conversation?')) onClearChat(); }}
            title="Clear chat"
          >
            🗑
          </button>
        )}

        <button
          className="chat__send"
          onClick={() => onSend()}
          disabled={inputDisabled || micActive || (!input.trim() && attachments.length === 0)}
        >
          {meetingMode ? 'ASK' : 'SEND'}
        </button>
      </div>
    </div>
  );
}
