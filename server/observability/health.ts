export interface DependencyCheck {
  name: string;
  required: boolean;
  check: () => Promise<void>;
}

export interface DependencyHealth {
  name: string;
  required: boolean;
  status: 'ok' | 'failed' | 'skipped';
  latencyMs: number;
}

export interface ReadinessReport {
  status: 'ok' | 'degraded';
  ready: boolean;
  checkedAt: string;
  dependencies: DependencyHealth[];
}

export interface LivenessReport {
  status: 'ok';
  live: true;
  checkedAt: string;
}

async function boundedCheck(check: () => Promise<void>, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('dependency health check timed out')), timeoutMs);
    void check().then(() => { clearTimeout(timer); resolve(); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

/** Liveness intentionally performs no dependency I/O; readiness performs all required dependency checks. */
export class OperationalHealth {
  constructor(private readonly dependencies: readonly DependencyCheck[], private readonly timeoutMs = 3_000) {}

  live(): LivenessReport {
    return { status: 'ok', live: true, checkedAt: new Date().toISOString() };
  }

  async ready(): Promise<ReadinessReport> {
    const dependencies = await Promise.all(this.dependencies.map(async (dependency): Promise<DependencyHealth> => {
      if (!dependency.required) return { name: dependency.name, required: false, status: 'skipped', latencyMs: 0 };
      const startedAt = Date.now();
      try {
        await boundedCheck(dependency.check, this.timeoutMs);
        return { name: dependency.name, required: true, status: 'ok', latencyMs: Date.now() - startedAt };
      } catch {
        return { name: dependency.name, required: true, status: 'failed', latencyMs: Date.now() - startedAt };
      }
    }));
    const ready = dependencies.every((dependency) => !dependency.required || dependency.status === 'ok');
    return { status: ready ? 'ok' : 'degraded', ready, checkedAt: new Date().toISOString(), dependencies };
  }
}
