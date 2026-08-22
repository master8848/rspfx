export function isAllowedOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '::1' ||
      h.endsWith('.sharepoint.com') ||
      h.endsWith('.sharepoint-df.com') ||
      h.endsWith('.sharepoint.cn')
    );
  } catch {
    return false;
  }
}
