import { useEffect, useRef, useState } from "react";

interface TextOverlayEditorProps {
  rect: { left: number; top: number; width: number; height: number };
  initialText: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export default function TextOverlayEditor({
  rect,
  initialText,
  onCommit,
  onCancel
}: TextOverlayEditorProps) {
  const [value, setValue] = useState(initialText);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    onCommit(value);
  };

  const cancel = () => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    onCancel();
  };

  return (
    <textarea
      ref={inputRef}
      className="text-editor"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      }}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          commit();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
      onBlur={() => commit()}
    />
  );
}