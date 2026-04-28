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
    let isMounted = true;

    getBackendSrv()
      .get('/api/user')
      .then((data) => {
        if (isMounted) {
          setUser(data);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch user:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { user };
};
