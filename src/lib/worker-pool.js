/** @import { UUID } from 'node:crypto' */
import { randomUUID } from 'node:crypto'
import { Worker } from 'node:worker_threads'

/**
 * @template TaskInput
 * @template TaskResult
 * @template {{ id: UUID; data?: TaskInput }} [Task={id: UUID; data?: TaskInput}]
 */
export class WorkerPool {
  /** @type {{ task: Task; resolve: TaskResolver<TaskResult> }[]} */
  taskQueue = []

  #workerPath
  /** @type {Worker[]} */
  #workers = []
  /** @type {Map<string, ActiveTask<TaskResult>>} */
  #activeTasks = new Map()

  /**
   * @param {string} workerPath
   * @param {number} [poolSize]
   */
  constructor(workerPath, poolSize = 1) {
    this.#workerPath = workerPath
    for (let i = 0; i < poolSize; i++) {
      this.addWorker()
    }
  }

  addWorker() {
    const worker = new Worker(this.#workerPath)
    worker.on('message', (msg) => {
      const task = this.#activeTasks.get(msg.id)
      this.#activeTasks.delete(msg.id)
      if (!task) return
      task.resolve(msg.result)
      this.checkQueue(worker)
    })
    worker.on('error', console.error)
    worker.on('exit', () => {
      this.#workers = this.#workers.filter((w) => w !== worker)
      this.addWorker() // Replace worker if it exits unexpectedly
    })
    this.#workers.push(worker)
  }

  /**
   * @param {TaskInput} [data]
   * @returns {Promise<TaskResult>}
   */
  runTask(data) {
    return new Promise((resolve) => {
      // @ts-expect-error Not sure how to type this with JSDoc
      this.taskQueue.push({ task: { id: randomUUID(), data }, resolve })
      this.checkQueue()
    })
  }

  /**
   * @param {Worker} [workerOverride]
   */
  checkQueue(workerOverride) {
    if (this.taskQueue.length === 0) return
    const idleWorker =
      workerOverride ||
      this.#workers.find(
        (worker) => ![...this.#activeTasks.values()].some((task) => task.worker === worker),
      )
    if (!idleWorker) return
    const queuedTask = this.taskQueue.shift()
    if (!queuedTask) return
    const { task, resolve } = queuedTask
    this.#activeTasks.set(task.id, { worker: idleWorker, resolve })
    idleWorker.postMessage(task)
  }

  async destroy() {
    return Promise.all(this.#workers.map((worker) => worker.terminate()))
  }
}

/**
 * @template TaskResult
 * @typedef {(result: TaskResult) => void} TaskResolver<TaskResult>
 */
/**
 * @template TaskResult
 * @typedef {Object} ActiveTask<TaskResult>
 * @property {Worker} worker
 * @property {TaskResolver<TaskResult>} resolve
 */
