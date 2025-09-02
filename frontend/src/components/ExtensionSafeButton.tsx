"use client";

import { Button } from "~/components/ui/button";
import { ButtonProps } from "~/components/ui/button";
import { forwardRef, useState, useEffect } from "react";

/**
 * A button component that prevents hydration warnings caused by browser extensions
 * that modify button attributes (like jf-ext-button-ct, jf-ext-cache-id)
 * by rendering only on the client side after mount
 */
const ExtensionSafeButton = forwardRef<
  HTMLButtonElement,
  ButtonProps & { children: React.ReactNode }
>(({ children, ...props }, ref) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder with the same dimensions to prevent layout shift
    return (
      <div 
        className={`${props.className} opacity-0 pointer-events-none`}
        style={{ 
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '2.5rem', // Default button height
          padding: '0.5rem 1rem'
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <Button ref={ref} {...props}>
      {children}
    </Button>
  );
});

ExtensionSafeButton.displayName = "ExtensionSafeButton";

export { ExtensionSafeButton };