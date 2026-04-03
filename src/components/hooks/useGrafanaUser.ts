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

  useEffect(() => {
    getBackendSrv()
      .get('/api/user')
      .then((data) => setUser(data))
      .catch(() => {});
  }, []);

  return { user };
};
