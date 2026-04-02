import { useState, useRef } from 'react';
import { Paperclip, ArrowUp } from 'lucide-react';
import styles from './CenterPanel.module.css';

interface InputAreaProps {
  onSend: (text: string) => void;
  onFileUpload: (file: File) => void;
  disabled?: boolean;
}

export function InputArea({ onSend, onFileUpload, disabled }: InputAreaProps) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = '';
    }
  };

  return (
    <div className={styles.inputArea}>
      <div className={styles.inputWrap}>
        <input
          type="file"
          ref={fileRef}
          style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFileChange}
        />
        <button
          className={styles.uploadBtn}
          title="上传文档"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip size={14} />
        </button>
        <input
          type="text"
          className={styles.textInput}
          placeholder="输入任务指令，或上传文档..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={disabled}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={disabled || !text.trim()}
        >
          <ArrowUp size={14} />
        </button>
      </div>
    </div>
  );
}
