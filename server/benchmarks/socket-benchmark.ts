import { performance } from 'node:perf_hooks';
import { createSocketHarness } from '../tests/performance/socket-harness';

async function main(): Promise<void> {
  const harness = await createSocketHarness(3);
  try {
    async function measure(name: string, actions: number, operation: () => Promise<void>): Promise<void> {
      harness.resetMetrics();
      const started = performance.now();
      await operation();
      const { snapshots, payloadBytes, runtimeWrites, recipients } = harness.metrics;
      process.stdout.write(`${JSON.stringify({
        workload: name, rooms: 3, accounts: 12, actions, snapshots,
        payloadBytes, runtimeWrites, uniqueRecipientAccounts: recipients.size,
        elapsedMs: Number((performance.now() - started).toFixed(2)),
      })}\n`);
    }
    const actor = harness.clients[0][0];
    await measure('chat', 1, async (): Promise<void> => {
      await actor.timeout(5_000).emitWithAck('chat:send', { message: 'Benchmark message' });
    });
    await measure('unchanged-resume', 10, async (): Promise<void> => {
      for (let action = 0; action < 10; action += 1) {
        await actor.timeout(5_000).emitWithAck('player:resume');
      }
    });
    await measure('leave-room', 1, async (): Promise<void> => {
      await actor.timeout(5_000).emitWithAck('room:leave');
    });
  } finally {
    await harness.close();
  }
}

void main().catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
