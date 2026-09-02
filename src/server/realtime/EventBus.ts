export type SecurityStreamEvent = {
  type: "analytics" | "anomaly" | "baseline" | "heartbeat";
  payload: unknown;
};

type Listener = (event: SecurityStreamEvent) => void;
const listeners = new Map<string, Set<Listener>>();

export function subscribeSecurityStream(userId: string, listener: Listener): () => void {
  const userListeners = listeners.get(userId) ?? new Set<Listener>();
  userListeners.add(listener);
  listeners.set(userId, userListeners);
  return () => {
    userListeners.delete(listener);
    if (userListeners.size === 0) listeners.delete(userId);
  };
}

export function publishSecurityStream(userId: string, event: SecurityStreamEvent): void {
  for (const listener of listeners.get(userId) ?? []) listener(event);
}

export function publishHeartbeat(): void {
  for (const [userId, userListeners] of listeners) {
    for (const listener of userListeners) listener({ type: "heartbeat", payload: { timestamp: Date.now(), userId } });
  }
}
