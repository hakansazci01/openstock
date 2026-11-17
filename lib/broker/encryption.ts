/**
 * Broker API credential encryption utilities.
 *
 * SECURITY WARNING: API keys/secrets are stored encrypted at rest.
 * In production, use a proper KMS (AWS KMS, Azure Key Vault, Google Cloud KMS)
 * or libsodium for encryption. This example uses Node.js crypto with a
 * master key from ENCRYPTION_MASTER_KEY env var (32 bytes for AES-256).
 */
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getMasterKey(): Buffer {
    const envKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!envKey) {
        throw new Error('ENCRYPTION_MASTER_KEY environment variable is required for broker credential encryption');
    }
    const buf = Buffer.from(envKey, 'hex');
    if (buf.length !== KEY_LENGTH) {
        throw new Error('ENCRYPTION_MASTER_KEY must be 32 bytes (64 hex characters)');
    }
    return buf;
}

export async function encrypt(text: string): Promise<string> {
    const masterKey = getMasterKey();
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = await scryptAsync(masterKey, salt, KEY_LENGTH) as Buffer;
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

export async function decrypt(encryptedBase64: string): Promise<string> {
    const masterKey = getMasterKey();
    const data = Buffer.from(encryptedBase64, 'base64');
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const key = await scryptAsync(masterKey, salt, KEY_LENGTH) as Buffer;
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
}

export function generateMasterKey(): string {
    return randomBytes(KEY_LENGTH).toString('hex');
}