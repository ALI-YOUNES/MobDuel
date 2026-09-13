"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, verifySession } from "./auth";

/**
 * Used on guest-facing pages (hello, login). If a stored token is still valid,
 * the user is already logged in and gets redirected to /welcome.
 * Returns { checking, player } once the check completes.
 */
export function useGuestGuard() {
  const router = useRouter();
  const [state, setState] = useState({ checking: true, player: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getToken();
      if (!token) {
        if (!cancelled) setState({ checking: false, player: null });
        return;
      }
      const player = await verifySession();
      if (cancelled) return;
      if (player) {
        setState({ checking: false, player });
        router.replace("/welcome");
      } else {
        setState({ checking: false, player: null });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

/**
 * Used on protected pages (welcome). Verifies the stored token; if invalid or
 * missing, the user is redirected to /login. Returns { checking, player }.
 */
export function useAuthGuard() {
  const router = useRouter();
  const [state, setState] = useState({ checking: true, player: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getToken();
      if (!token) {
        if (!cancelled) {
          setState({ checking: false, player: null });
          router.replace("/login");
        }
        return;
      }
      const player = await verifySession();
      if (cancelled) return;
      if (player) {
        setState({ checking: false, player });
      } else {
        setState({ checking: false, player: null });
        router.replace("/login");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
