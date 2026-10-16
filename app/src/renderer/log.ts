// Writes to the diagnostics log through the main process. Never pass passwords,
// keys, clipboard text or file names; partner IDs are shortened by the main process.
type Level = 'info' | 'warn' | 'error';

const describe = (value: unknown): string =>
  value instanceof Error ? `${value.name}: ${value.message}` : typeof value === 'string' ? value : JSON.stringify(value) ?? String(value);

const write = (level: Level, source: string, message: unknown) => {
  try {
    window.api.log(level, source, describe(message));
  } catch {
    // preload not ready
  }
};

export const logInfo = (source: string, message: unknown) => write('info', source, message);
export const logWarn = (source: string, message: unknown) => write('warn', source, message);
export const logError = (source: string, message: unknown) => write('error', source, message);

// Uncaught errors and console.error/warn calls end up in the log too.
export function captureErrors() {
  window.addEventListener('error', (e) => logError('app', `${e.message} (${e.filename?.split('/').pop()}:${e.lineno})`));
  window.addEventListener('unhandledrejection', (e) => logError('app', `unhandled rejection: ${describe(e.reason)}`));
  for (const level of ['error', 'warn'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      write(level, 'app', args.map(describe).join(' '));
    };
  }
}

// Logs WebRTC connection state changes and, once connected, whether the route is
// direct (same network or through NAT) or via a TURN relay.
export function watchConnection(source: string, pc: RTCPeerConnection | undefined) {
  if (!pc) return;
  const report = async () => {
    logInfo(source, `connection ${pc.connectionState}`);
    if (pc.connectionState !== 'connected') return;
    try {
      const stats = await pc.getStats();
      let pair: RTCIceCandidatePairStats | undefined;
      stats.forEach((s) => {
        if (s.type === 'candidate-pair' && (s as RTCIceCandidatePairStats).nominated && s.state === 'succeeded') pair = s;
      });
      const local = pair && (stats.get(pair.localCandidateId) as { candidateType?: string; protocol?: string } | undefined);
      const remote = pair && (stats.get(pair.remoteCandidateId) as { candidateType?: string } | undefined);
      if (local) {
        const relay = local.candidateType === 'relay' || remote?.candidateType === 'relay';
        logInfo(source, `route ${relay ? 'TURN relay' : 'direct'} (${local.candidateType}/${remote?.candidateType ?? '?'}, ${local.protocol ?? '?'})`);
      }
    } catch {
      // stats unavailable
    }
  };
  pc.addEventListener('connectionstatechange', () => void report());
  if (pc.connectionState === 'connected') void report();
}
