import React from 'react';
import { Button } from '@grafana/ui';
import { EndpointConfig } from 'types';
import { EndpointEditor, EndpointEditorHandle } from '../../endpointEditor/endpointEditor';

interface EndpointsSectionProps {
  endpoints: EndpointConfig[];
  onChange: (endpoints: EndpointConfig[]) => void;
  endpointRefs: React.MutableRefObject<Array<EndpointEditorHandle | null>>;
}

export const EndpointsSection: React.FC<EndpointsSectionProps> = ({ endpoints, onChange, endpointRefs }) => {
  const addEndpoint = () => {
    const newEndpoint: EndpointConfig = {
      operation: '',
      method: 'POST',
      path: '',
      body: {},
      saveToContext: [],
      polling: { enabled: false },
      headers: {},
      replyField: '',
    };
    onChange([...endpoints, newEndpoint]);
  };

  const updateEndpoint = (index: number, updated: EndpointConfig) => {
    const newEndpoints = [...endpoints];
    newEndpoints[index] = updated;
    onChange(newEndpoints);
  };

  const removeEndpoint = (index: number) => {
    const newEndpoints = endpoints.filter((_, i) => i !== index);
    onChange(newEndpoints);
  };

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4 style={{ margin: 0 }}>Endpoints</h4>
        <Button icon="plus" onClick={addEndpoint} variant="secondary" size="sm">
          Add endpoint
        </Button>
      </div>
      {endpoints.length === 0 && (
        <div style={{ color: '#999', marginBottom: '8px', fontSize: '12px' }}>No endpoints configured</div>
      )}
      {endpoints.map((endpoint, idx) => (
        <EndpointEditor
          key={idx}
          ref={(el) => (endpointRefs.current[idx] = el)}
          endpoint={endpoint}
          index={idx}
          onChange={updateEndpoint}
          onRemove={removeEndpoint}
        />
      ))}
    </div>
  );
};
