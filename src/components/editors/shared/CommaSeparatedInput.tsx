import React, { useState, useEffect } from 'react';
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
  const [rawString, setRawString] = useState(value.join(', '));

  useEffect(() => {
    setRawString(value.join(', '));
  }, [value]);

  const handleBlur = () => {
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
        onChange={(e) => setRawString(e.currentTarget.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
      />
    </Field>
  );
};
