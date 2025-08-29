import schedule from 'node-schedule';

export class JobRegistry {
  constructor() { this.jobs = new Map(); }
  add(id, job) { this.jobs.set(id, job); }
  remove(id) { const j = this.jobs.get(id); if (j) j.cancel(); this.jobs.delete(id); }
  list() { return [...this.jobs.keys()]; }
}

export function scheduleSend(registry, id, runAt, handler) {
  const job = schedule.scheduleJob(runAt, handler);
  registry.add(id, job);
  return job;
}
