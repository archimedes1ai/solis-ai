export default function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';

  const renderBody = (text) => {
    if (!text || typeof text !== 'string') return text;
    return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );
  };

  const displayText = msg.displayText || (typeof msg.content === 'string' ? msg.content : '');
  const ts = msg.ts ? new Date(msg.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className={`msg msg--${isUser ? 'user' : 'solis'}`}>
      {!isUser && <div className="msg__avatar">S</div>}
      <div className="msg__col">
        <div className={`msg__body${msg.isError ? ' msg__body--error' : ''}`}>
          {renderBody(displayText)}
          {msg.attachments?.length > 0 && (
            <div className="msg__atts">
              {msg.attachments.map((a, i) => <span key={i} className="msg__att">📎 {a.name}</span>)}
            </div>
          )}
        </div>
        {msg.agents?.length > 0 && (
          <div className="msg__agents">
            {msg.agents.map((a, i) => <span key={i} className="msg__agent-tag">{a}</span>)}
          </div>
        )}
        <div className="msg__meta">{ts}</div>
      </div>
    </div>
  );
}
