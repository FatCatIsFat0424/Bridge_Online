import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 131072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const MAX_CONCURRENT_HASHES = 2;
const MAX_WAITING_HASHES = 16;
let activeHashes = 0;
const waiting: Array<() => void> = [];

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (activeHashes >= MAX_CONCURRENT_HASHES) {
    if (waiting.length >= MAX_WAITING_HASHES) {
      throw Object.assign(new Error('Too many authentication attempts. Please try again later.'), {
        status: 429,
        code: 'RATE_LIMITED',
      });
    }
    await new Promise<void>((resolve) => {
      waiting.push(resolve);
    });
  } else {
    activeHashes += 1;
  }
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password,
        salt,
        64,
        { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 256 * 1024 * 1024 },
        (error, key) => {
          if (error) reject(error);
          else resolve(key);
        },
      );
    });
  } finally {
    const next = waiting.shift();
    if (next) next();
    else activeHashes -= 1;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${key.toString('hex')}`;
}

// A missing username costs the same password derivation as a registered username.
const DUMMY_HASH = `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${'00'.repeat(16)}$${'00'.repeat(64)}`;

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  const stored = hash ?? DUMMY_HASH;
  const parts = stored.split('$');
  if (
    parts.length !== 6 ||
    parts[0] !== 'scrypt' ||
    parts[1] !== String(SCRYPT_N) ||
    parts[2] !== String(SCRYPT_R) ||
    parts[3] !== String(SCRYPT_P) ||
    !/^[\da-f]{32}$/.test(parts[4]) ||
    !/^[\da-f]{128}$/.test(parts[5])
  )
    return false;
  const key = await derive(password, Buffer.from(parts[4], 'hex'));
  return timingSafeEqual(key, Buffer.from(parts[5], 'hex')) && hash !== null;
}
