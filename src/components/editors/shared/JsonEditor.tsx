// src/components/shared/ui/JsonEditor.tsx (исправленная версия)
import React, { useState, useEffect, useRef } from 'react';
import { TextArea, Field } from '@grafana/ui';

interface JsonEditorProps {
  value?: Record<string, any>;
  onChange: (obj: Record<string, any>) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  description?: React.ReactNode;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  label,
  placeholder,
  rows = 4,
  disabled = false,
  description,
}) => {
  const [jsonString, setJsonString] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lastValidValueRef = useRef<Record<string, any>>(value || {});

  useEffect(() => {
    if (value) {
      setJsonString(JSON.stringify(value, null, 2));
      lastValidValueRef.current = value;
      setError(null);
    } else {
      setJsonString('');
      lastValidValueRef.current = {};
      setError(null);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newString = e.currentTarget.value;
    setJsonString(newString);

    if (newString.trim() === '') {
      setError(null);
      return;
    }

    try {
      const parsed = JSON.parse(newString);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Must be a JSON object');
      }
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const handleBlur = () => {
    const trimmed = jsonString.trim();
    if (trimmed === '') {
      setError(null);
      lastValidValueRef.current = {};
      onChange({});
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Must be a JSON object');
      }
      setError(null);
      lastValidValueRef.current = parsed;
      onChange(parsed);
    } catch (err) {
      // Ошибка уже отображается, значение не сохраняем
    }
  };

  return (
    <Field label={label} invalid={!!error} error={error} description={description}>
      <TextArea
        value={jsonString}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        style={{ fontFamily: 'monospace', fontSize: '12px' }}
      />
    </Field>
  );
};
