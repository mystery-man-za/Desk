import { randomBytes, scrypt as callbackScrypt, timingSafeEqual } from 'node:crypto';

const keyLength = 64;
const cost = 16384;
const blockSize = 8;
const parallelization = 1;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 64 * 1024 * 1024,
  });

  return `scrypt$${cost}$${blockSize}$${parallelization}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [algorithm, costText, blockText, parallelText, saltHex, keyHex] =
    encodedHash.split('$');
  if (
    algorithm !== 'scrypt' ||
    !/^\d+$/.test(costText ?? '') ||
    !/^\d+$/.test(blockText ?? '') ||
    !/^\d+$/.test(parallelText ?? '') ||
    !/^[0-9a-f]+$/i.test(saltHex ?? '') ||
    !/^[0-9a-f]+$/i.test(keyHex ?? '')
  ) {
    return false;
  }

  const expected = Buffer.from(keyHex, 'hex');
  if (expected.length !== keyLength || saltHex.length !== 32) return false;
  const parameters = {
    N: Number(costText),
    r: Number(blockText),
    p: Number(parallelText),
  };
  if (
    parameters.N !== cost ||
    parameters.r !== blockSize ||
    parameters.p !== parallelization
  ) {
    return false;
  }
  const actual = await deriveKey(
    password,
    Buffer.from(saltHex, 'hex'),
    expected.length,
    { ...parameters, maxmem: 64 * 1024 * 1024 },
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function deriveKey(
  password: string,
  salt: Buffer,
  length: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    callbackScrypt(password, salt, length, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}
