import React, { useState, useEffect, useRef } from 'react';
import { Input, Field } from '@grafana/ui';

interface CommaSeparatedInputProps {
  value?: string[];
  onChange: (values: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  description?: React.ReactNode;
}

export const CommaSeparatedInput: React.FC<CommaSeparatedInputProps> = ({
  value = [],
  onChange,
  label,
  placeholder,
  disabled,
  description,
}) => {
  const [rawString, setRawString] = useState(() => value.join(', '));
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current) {
      setRawString(value.join(', '));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isEditingRef.current = true;
    setRawString(e.currentTarget.value);
  };

  const handleBlur = () => {
    isEditingRef.current = false;

    const values = rawString
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onChange(values);
  };

  return (
    <Field label={label} description={description}>
      <Input
        value={rawString}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
      />
    </Field>
  );
};
