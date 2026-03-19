import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ENCRYPTED_PREFIX = 'enc::';

function getEncryptionSecret() {
  const secret = process.env.TOKEN_ENCRYPTION_SECRET?.trim();

  if (!secret) {
    throw new Error('TOKEN_ENCRYPTION_SECRET is not configured.');
  }

  return createHash('sha256').update(secret).digest();
}

export function encryptToken(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return trimmedValue;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(trimmedValue, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }

  const payload = value.slice(ENCRYPTED_PREFIX.length);
  const [iv, authTag, encrypted] = payload.split('.');

  if (!iv || !authTag || !encrypted) {
    throw new Error('Stored token payload is malformed.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionSecret(),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
