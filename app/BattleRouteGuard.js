"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Guards navigation away from the battle screen (and back to it):
// If a player leaves `/battle` and lands on `/lobby`, they are redirected to
// `/join-host`. Any other destination is allowed. This makes leaving the
// battle to the lobby behave like returning home from the match.
export default function BattleRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const prevRef = useRef(pathname);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = pathname;
    if (prev === "/battle" && pathname === "/lobby") {
      router.replace("/join-host");
    }
  }, [pathname, router]);

  return null;
}
