interface ToastMessage {
  id: string;
  type: "error" | "warning" | "info";
  message: string;
}

interface StatusBarProps {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function StatusBar({ messages, onDismiss }: StatusBarProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack">
      {messages.map((status) => (
        <div key={status.id} className={`toast toast-${status.type}`}>
          <span>{status.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(status.id)}
            aria-label="閉じる"
            className="toast-close"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}