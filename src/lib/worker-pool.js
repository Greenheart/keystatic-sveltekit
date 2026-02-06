/** @import { UUID } from 'node:crypto' */
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
export class WorkerPool {
    /** @default undefined[] */
    taskQueue = [];
    #workerPath;
    /** @default undefined[] */
    #workers = [];
    /** @default Map<any, any> */
    #activeTasks = new Map();
    /**
       * @param {string} workerPath
       * @param {number} [poolSize=1]
       */
    constructor(workerPath, poolSize = 1) {
        this.#workerPath = workerPath;
        for (let i = 0; i < poolSize; i++) {
            this.addWorker();
        }
    }
    /**
       * @returns {void}
       */
    addWorker() {
        const worker = new Worker(this.#workerPath);
        worker.on('message', (msg) => {
            const { resolve } = this.#activeTasks.get(msg.id);
            this.#activeTasks.delete(msg.id);
            resolve(msg.result);
            this.checkQueue(worker);
        });
        worker.on('error', console.error);
        worker.on('exit', () => {
            this.#workers = this.#workers.filter((w) => w !== worker);
            this.addWorker(); // Replace worker if it exits unexpectedly
        });
        this.#workers.push(worker);
    }
    /**
       * @param {TaskInput} [data]
       * @returns {Promise<TaskResult>}
       */
    runTask(data) {
        return new Promise((resolve) => {
            this.taskQueue.push({ task: { id: randomUUID(), data }, resolve });
            this.checkQueue();
        });
    }
    /**
       * @param {Worker} [workerOverride]
       * @returns {void}
       */
    checkQueue(workerOverride) {
        if (this.taskQueue.length === 0)
            return;
        const idleWorker = workerOverride ||
            this.#workers.find((worker) => ![...this.#activeTasks.values()].some((task) => task.worker === worker));
        if (!idleWorker)
            return;
        const { task, resolve } = this.taskQueue.shift();
        this.#activeTasks.set(task.id, { worker: idleWorker, resolve });
        idleWorker.postMessage(task);
    }
    /**
       * @returns {Promise<number[]>}
       */
    async destroy() {
        return Promise.all(this.#workers.map((worker) => worker.terminate()));
    }
}
/**
 * @typedef {(result: TaskResult) => void} TaskResolver
 * @template TaskResult
 */
/**
 * @typedef {Object} ActiveTask
 * @property {Worker} worker
 * @property {TaskResolver<TaskResult>} resolve
 * @template TaskResult
 */
