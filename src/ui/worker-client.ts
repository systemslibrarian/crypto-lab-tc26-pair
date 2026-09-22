interface WorkerRequest {
  action: string;
  [key: string]: unknown;
}

interface WorkerReply {
  id: number;
  ok: boolean;
  payload?: unknown;
  error?: string;
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(reason: Error): void;
}

export class ReferenceWorkerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, PendingRequest>();
  private nextId = 1;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener('message', (event: MessageEvent<WorkerReply>) => {
      const request = this.pending.get(event.data.id);
      if (!request) return;
      this.pending.delete(event.data.id);
      if (event.data.ok) request.resolve(event.data.payload);
      else request.reject(new Error(event.data.error ?? 'Reference worker failed'));
    });
    this.worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'Reference worker crashed');
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
    });
  }

  request<Result>(request: WorkerRequest): Promise<Result> {
    const id = this.nextId++;
    return new Promise<Result>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as Result),
        reject,
      });
      this.worker.postMessage({ ...request, id });
    });
  }
}