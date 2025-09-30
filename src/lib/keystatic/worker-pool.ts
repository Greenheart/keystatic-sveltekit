import { randomUUID, type UUID } from 'node:crypto'
import { Worker } from 'node:worker_threads'

type TaskResolver<TaskResult> = (result: TaskResult) => void

type ActiveTask<TaskResult> = {
  worker: Worker
  resolve: TaskResolver<TaskResult>
}

export class WorkerPool<
  TaskInput,
  TaskResult,
  Task extends { id: UUID; data?: TaskInput } = { id: UUID; data?: TaskInput },
> {
  taskQueue: { task: Task; resolve: TaskResolver<TaskResult> }[] = []

  #workerPath: string
  #workers: Worker[] = []
  #activeTasks: Map<string, ActiveTask<TaskResult>> = new Map()

  constructor(workerPath: string, poolSize = 1) {
    this.#workerPath = workerPath

    for (let i = 0; i < poolSize; i++) {
      this.addWorker()
    }
  }

  addWorker() {
    const worker = new Worker(this.#workerPath)
    worker.on('message', (msg) => {
      const { resolve } = this.#activeTasks.get(msg.id)!
      this.#activeTasks.delete(msg.id)
      resolve(msg.result)
      this.checkQueue(worker)
    })
    worker.on('error', console.error)
    worker.on('exit', () => {
      this.#workers = this.#workers.filter((w) => w !== worker)
      this.addWorker() // Replace worker if it exits unexpectedly
    })
    this.#workers.push(worker)
  }

  runTask(data?: TaskInput): Promise<TaskResult> {
    return new Promise((resolve) => {
      this.taskQueue.push({ task: { id: randomUUID(), data } as Task, resolve })
      this.checkQueue()
    })
  }

  checkQueue(workerOverride?: Worker) {
    if (this.taskQueue.length === 0) return

    const idleWorker =
      workerOverride ||
      this.#workers.find(
        (worker) => ![...this.#activeTasks.values()].some((task) => task.worker === worker),
      )

    if (!idleWorker) return

    const { task, resolve } = this.taskQueue.shift()!
    this.#activeTasks.set(task.id, { worker: idleWorker, resolve })
    idleWorker.postMessage(task)
  }

  destroy() {
    this.#workers.forEach((worker) => worker.terminate())
  }
}
