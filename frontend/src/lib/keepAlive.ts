/**
 * Keep-alive service to prevent Railway server cold starts
 * Pings the server every 10 minutes to keep it warm
 */

let pingInterval: NodeJS.Timeout | null = null;
let isEnabled = false;

const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes
const API_HEALTH_URL = 'https://kai-sign-production.up.railway.app/api/health';

async function pingServer(): Promise<void> {
  try {
    console.log('🏓 Pinging server to keep it warm...');
    
    const response = await fetch(API_HEALTH_URL, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (response.ok) {
      console.log('✅ Server ping successful');
    } else {
      console.log(`⚠️ Server ping returned ${response.status}`);
    }
  } catch (error) {
    console.log('❌ Server ping failed:', error instanceof Error ? error.message : 'Unknown error');
    // Don't throw - we don't want ping failures to break the app
  }
}

/**
 * Start the keep-alive ping service
 * Only runs in production and when window is available
 */
export function startKeepAlive(): void {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return;
  }

  // Only run in production or when explicitly enabled
  const isProduction = process.env.NODE_ENV === 'production';
  const forceEnable = process.env.NEXT_PUBLIC_ENABLE_KEEP_ALIVE === 'true';
  
  if (!isProduction && !forceEnable) {
    console.log('🔇 Keep-alive disabled in development (set NEXT_PUBLIC_ENABLE_KEEP_ALIVE=true to enable)');
    return;
  }

  if (isEnabled) {
    console.log('🔇 Keep-alive already running');
    return;
  }

  console.log('🚀 Starting keep-alive service (ping every 10 minutes)');
  
  // Initial ping after 30 seconds
  setTimeout(pingServer, 30000);
  
  // Set up recurring pings
  pingInterval = setInterval(pingServer, PING_INTERVAL);
  isEnabled = true;

  // Stop pings when page is hidden/closed to save resources
  const handleVisibilityChange = () => {
    if (document.hidden) {
      console.log('🔇 Page hidden, pausing keep-alive');
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
    } else {
      console.log('👁️ Page visible, resuming keep-alive');
      if (!pingInterval && isEnabled) {
        pingInterval = setInterval(pingServer, PING_INTERVAL);
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Cleanup on beforeunload
  window.addEventListener('beforeunload', stopKeepAlive);
}

/**
 * Stop the keep-alive ping service
 */
export function stopKeepAlive(): void {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  isEnabled = false;
  console.log('🛑 Keep-alive service stopped');
}

/**
 * Get the current status of the keep-alive service
 */
export function getKeepAliveStatus(): { enabled: boolean; interval: number } {
  return {
    enabled: isEnabled,
    interval: PING_INTERVAL
  };
}