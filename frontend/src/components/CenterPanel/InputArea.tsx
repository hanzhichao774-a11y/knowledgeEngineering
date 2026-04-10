import { useState, useRef } from 'react';
import { Paperclip, ArrowUp, X } from 'lucide-react';
import styles from './CenterPanel.module.css';

interface InputAreaProps {
  onSend: (text: string) => void;
  onFileUpload: (files: File[]) => void;
  disabled?: boolean;
}

export function InputArea({ onSend, onFileUpload, disabled }: InputAreaProps) {
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (pendingFiles.length > 0) {
      onFileUpload(pendingFiles);
      setPendingFiles([]);
      setText('');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setPendingFiles((prev) => [...prev, ...Array.from(files)]);
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className={styles.inputArea}>
      {pendingFiles.length > 0 && (
        <div className={styles.pendingFiles}>
          {pendingFiles.map((f, i) => (
            <div key={`${f.name}-${i}`} className={styles.pendingFileItem}>
              <span className={styles.pendingFileIcon}>📄</span>
              <span className={styles.pendingFileName}>{f.name}</span>
              <span className={styles.pendingFileSize}>{formatSize(f.size)}</span>
              <button
                className={styles.pendingFileRemove}
                onClick={() => removeFile(i)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={styles.inputWrap}>
        <input
          type="file"
          ref={fileRef}
          style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          multiple
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
          disabled={disabled || (!text.trim() && pendingFiles.length === 0)}
        >
          <ArrowUp size={14} />
        </button>
      </div>
    </div>
  );
}
