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
