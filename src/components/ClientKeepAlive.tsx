"use client";

import { useEffect } from "react";
import { startKeepAlive } from "~/lib/keepAlive";

export function ClientKeepAlive() {
  useEffect(() => {
    startKeepAlive();
  }, []);

  return null;
}