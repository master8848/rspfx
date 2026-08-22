import { spawn } from 'node:child_process';

export function openBrowser(url: string): void {
  // Validate URL before handing to OS shell — win32 cmd injection via &|<> etc is blocked.
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return;
  } catch {
    return;
  }
  const platform = process.platform;
  if (platform === 'win32') {
    try {
      // Avoid cmd /c start (shell metachar injection) — use rundll32 file protocol handler.
      const child = spawn('rundll32', ['url.dll,FileProtocolHandler', url], { stdio: 'ignore', detached: true });
      child.on('error', () => {});
      child.unref();
      return;
    } catch {}
  }
  const command = platform === 'darwin' ? 'open' : 'xdg-open';
  const args = [url];
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
