import React from 'react';
import { EndpointConfig } from 'types';
import { JsonEditor } from 'components/editors/shared/JsonEditor';

interface HeadersSectionProps {
  endpoint: EndpointConfig;
  onChange: (field: keyof EndpointConfig, value: any) => void;
}

export const HeadersSection: React.FC<HeadersSectionProps> = ({ endpoint, onChange }) => {
  return (
    <div style={{ marginBottom: '16px' }}>
      <JsonEditor
        label="Headers (JSON object)"
        value={endpoint.headers}
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
  return (
    <div style={{ marginBottom: '16px' }}>
      <JsonEditor
        label="Body"
        value={endpoint.body}
        onChange={(newBody) => onChange('body', newBody)}
        placeholder='{"message": "{user_input}", "temperature": 0.7}'
        rows={6}
        description="Use {variable} for substitution from context."
      />
    </div>
  );
};
