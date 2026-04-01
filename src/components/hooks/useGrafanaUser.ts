import { useEffect, useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';

export interface GrafanaUser {
  id: number;
  login: string;
  email: string;
  name: string;
}

export const useGrafanaUser = () => {
  const [user, setUser] = useState<GrafanaUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBackendSrv()
      .get('/api/user')
      .then((data) => {
        setUser(data);
      })
      .catch((err) => console.error('Failed to fetch user', err))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
};
// 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 api key