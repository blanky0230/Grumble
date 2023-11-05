import { Listener, TypedEventEmitter } from "../lib/TypedEventEmitter";
import { Queue } from "../lib/Queue";

type Events<T> = {
    "enqueue": T,
    "dequeue": T | undefined
}

export class EventemittingQueue<T extends object> extends Queue<T> implements TypedEventEmitter<Events<T>> {
    listeners: {
        [K in keyof Events<T>]?: Set<Listener<Events<T>[K]>>;
    } = {};

    private proxyEmitter;

    constructor() {
        super();
        this.proxyEmitter = new TypedEventEmitter<Events<T>>();
        
    }

    public enqueue(item: T): void {
        super.enqueue(item);
        this.emit("enqueue", item);
    }

    public deque(): T | undefined {
        const val = super.deque();
        this.emit("dequeue", val);
        return val;
    }

    on<K extends "enqueue" | "dequeue">(event: K, listener: Listener<{ enqueue: T; dequeue: T | undefined; }[K]>): void {
        return this.proxyEmitter.on(event, listener);
    }
    
    emit<K extends "enqueue" | "dequeue">(event: K, args: { enqueue: T; dequeue: T | undefined; }[K]): void {
        return this.proxyEmitter.emit(event, args);
    }

    removeListener<K extends "enqueue" | "dequeue">(event: K, listener: Listener<{ enqueue: T; dequeue: T | undefined; }[K]>): void {
        return this.proxyEmitter.removeListener(event, listener);
    }
}