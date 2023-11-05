export type QueueNode<T> = {
    value: T,
    next?: QueueNode<T>
};

export class Queue<T> {

    public length: number = 0;
    private head?: QueueNode<T>;
    private tail?: QueueNode<T>;

    constructor() {
        this.length = 0;
        this.head = this.tail = undefined;
    }


    enqueue(item: T) {
        const node: QueueNode<T> = { value: item };

        if(this.tail === undefined) {
            this.head = this.tail = node;
        } else {
            this.tail.next = node;
            this.tail = node;
        }

        this.length++;
    }

    deque(): T | undefined {
        if(this.head === undefined) {
            return undefined;
        }

        this.length--;
        const head = this.head;
        this.head = this.head.next;

        if(this.length === 0) {
            this.tail = undefined;
        }

        return head.value;
    }

    peek(): T | undefined {
        return this.head?.value;
    }

}