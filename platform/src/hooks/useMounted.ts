"use client";

import { useState, useEffect } from "react";

/**
 * Returns false during SSR / static prerender and the first client render, then
 * true after mount. Use it to gate wallet-dependent UI so the first client
 * render matches the server HTML — avoiding React hydration mismatches caused by
 * wagmi restoring a connection only on the client.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
