export type Listener<T extends any> = (args: T) => void;

export class TypedEventEmitter<Events extends Record<string, any>> {
  public listeners: {
    [K in keyof Events]?: Set<Listener<Events[K]>>;
  } = {};

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>) {
    const listeners = this.listeners[event] ?? new Set();
    listeners.add(listener);
    this.listeners[event] = listeners;
  }

  emit<K extends keyof Events>(event: K, args: Events[K]) {
    for (const listener of this.listeners[event] ?? []) {
      listener(args);
    }
  }

  removeListener<K extends keyof Events>(event: K, listener: Listener<Events[K]>) {
    this.listeners[event]?.delete(listener);
  }
}

