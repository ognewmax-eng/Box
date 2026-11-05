import os from 'os';

export function getLocalIPs() {
  const list = [];
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const net of addresses || []) {
      if (net.family === 'IPv4' && !net.internal) list.push(net.address);
    }
  }
  return list;
}

function isPrivateLan(ip) {
  return ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

export function getLANIP() {
  const list = getLocalIPs();
  return list.find(isPrivateLan) || list[0] || 'localhost';
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Ссылка для QR-кода. Адрес localhost с телефона не откроется,
 * поэтому если ведущий зашёл через него, подставляем IP компьютера в сети.
 */
export function buildJoinUrl(joinBaseUrl, code, lanIp, port) {
  let base = null;
  if (typeof joinBaseUrl === 'string') {
    try {
      const parsed = new URL(joinBaseUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') base = parsed;
    } catch {
      // Некорректный адрес: используем адрес по умолчанию
    }
  }
  if (!base) base = new URL(`http://${lanIp}:${port}`);
  if (LOOPBACK_HOSTS.has(base.hostname) && lanIp && lanIp !== 'localhost') base.hostname = lanIp;
  return `${base.origin}/client?room=${code}`;
}
