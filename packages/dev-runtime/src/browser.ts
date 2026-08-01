import { spawn } from 'node:child_process';

export function openBrowser(url: string): void {
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {
      // Browser open is best-effort; failures are reported as warnings elsewhere.
    });
    child.unref();
  } catch {
    // Best-effort only.
  }
}
