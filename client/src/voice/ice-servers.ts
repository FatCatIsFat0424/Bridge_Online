/** Client configuration contains only publicly visible, preferably short-lived TURN credentials. */
export function parseIceServers(configuration?: string): RTCIceServer[] {
  if (configuration === undefined) return [{ urls: 'stun:stun.l.google.com:19302' }];
  let parsed: unknown;
  try {
    parsed = JSON.parse(configuration);
  } catch {
    throw new Error('Invalid ICE configuration.');
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 8)
    throw new Error('Invalid ICE configuration.');
  let urlCount = 0;
  return parsed.map((entry: unknown): RTCIceServer => {
    if (typeof entry !== 'object' || entry === null || !('urls' in entry))
      throw new Error('Invalid ICE server.');
    const server = entry as Record<string, unknown>;
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    urlCount += urls.length;
    if (
      urls.length === 0 ||
      urlCount > 16 ||
      !urls.every(
        (url: unknown) =>
          typeof url === 'string' &&
          url.length <= 2048 &&
          /^(stun|stuns|turn|turns):[^\s]+$/i.test(url),
      )
    )
      throw new Error('Invalid ICE server URL.');
    if (
      (server.username !== undefined &&
        (typeof server.username !== 'string' || server.username.length > 512)) ||
      (server.credential !== undefined &&
        (typeof server.credential !== 'string' || server.credential.length > 512))
    ) {
      throw new Error('Invalid ICE credentials.');
    }
    return {
      urls: urls as string[],
      ...(server.username !== undefined ? { username: server.username as string } : {}),
      ...(server.credential !== undefined ? { credential: server.credential as string } : {}),
    };
  });
}
