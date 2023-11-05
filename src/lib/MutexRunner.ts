export class MutexRunner{
    private isLocked: boolean;
    private queue: (() => Promise<unknown>)[];

    constructor() {
        this.isLocked = false;
        this.queue = [];
    }

    public async run<T>(callback: () => Promise<T>) {
        if(this.isLocked) {
            this.queue.push(callback);
        } else {
            this.isLocked = true;
            await callback();
            await this.release();
        }
    }

    public async release() {
        if(this.queue.length > 0) {
            const callback = this.queue.shift();
            callback && await callback();
        } else {
            this.isLocked = false;
        }
    }

}