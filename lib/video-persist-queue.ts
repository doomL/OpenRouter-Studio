/**
 * Global semaphore for background video-to-data-URL fetches.
 * Limits concurrent fetches to 1 so multiple completed video nodes
 * don't saturate the connection pool simultaneously.
 */
const MAX_CONCURRENT = 1;
let active = 0;
const queue: Array<() => void> = [];

function next() {
  if (active >= MAX_CONCURRENT || queue.length === 0) return;
  active++;
  const run = queue.shift()!;
  run();
}

export function enqueueVideoPersist(task: () => Promise<void>): () => void {
  let cancelled = false;

  const run = () => {
    if (cancelled) {
      active--;
      next();
      return;
    }
    task().finally(() => {
      active--;
      next();
    });
  };

  queue.push(run);
  next();

  return () => {
    cancelled = true;
  };
}
