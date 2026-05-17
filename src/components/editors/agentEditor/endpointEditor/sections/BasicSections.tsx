import React from 'react';
import { EndpointConfig } from 'types';
import { JsonEditor } from 'components/editors/shared/JsonEditor';

interface HeadersSectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

export const HeadersSection: React.FC<HeadersSectionProps> = ({ endpoint, onChange }) => {
  const headersValue = endpoint.headers ?? undefined;
  return (
    <div style={{ marginBottom: '16px' }}>
      <JsonEditor
        label="Headers (JSON object)"
        value={headersValue as Record<string, any> | undefined}
        onChange={(newHeaders) => onChange('headers', newHeaders)}
        placeholder='{"Authorization": "Bearer token"}'
        rows={3}
      />
    </div>
  );
};

interface BodySectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

export const BodySection: React.FC<BodySectionProps> = ({ endpoint, onChange }) => {
  const bodyValue = endpoint.body ?? undefined;
  return (
    <div style={{ marginBottom: '16px' }}>
      <JsonEditor
        label="Body"
        value={bodyValue as Record<string, any> | undefined}
        onChange={(newBody) => onChange('body', newBody)}
        placeholder='{"message": "{user_input}", "temperature": 0.7}'
        rows={6}
        description="Use {variable} for substitution from context."
      />
    </div>
  );
};
