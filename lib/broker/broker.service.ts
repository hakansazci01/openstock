'use server';

import { connectToDatabase } from '@/database/mongoose';
import { BrokerCredentials } from '@/database/models/broker-credentials.model';
import { requireUserId } from '@/lib/better-auth/auth';
import { encrypt, decrypt } from '@/lib/broker/encryption';
import {
    createBrokerAdapter,
    isLiveBrokerUrl,
    isSupportedBroker,
    normalizeBrokerUrl,
    type SupportedBroker,
} from '@/lib/broker/registry';

/**
 * Broker credential storage.
 *
 * Secrets are encrypted at rest and are never returned to the browser. Callers
 * that only render status must use `getBrokerSummary`; only server-side trading
 * code may call `getBrokerCredentials`.
 */

export type SafeBrokerSummary = {
    id: string;
    broker: SupportedBroker;
    apiUrl: string;
    isLive: boolean;
    isConnected: boolean;
    lastSyncedAt: Date | null;
    apiKeyHint: string;
};

function assertSecret(value: unknown, field: string, maxLength: number): string {
    if (typeof value !== 'string') throw new Error(`${field} metin olmalıdır`);
    const trimmed = value.trim();
    if (!trimmed) throw new Error(`${field} boş olamaz`);
    if (trimmed.length > maxLength) throw new Error(`${field} çok uzun`);
    if (/[\s\x00-\x1f\x7f]/.test(trimmed)) throw new Error(`${field} boşluk veya kontrol karakteri içeremez`);
    return trimmed;
}

function maskKey(apiKey: string): string {
    if (apiKey.length <= 4) return '••••';
    return `••••${apiKey.slice(-4)}`;
}

function assertCredentialsId(id: string): void {
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new Error('Geçersiz broker kayıt kimliği');
}

/**
 * Verifies the credentials against the broker's official endpoint.
 * Never throws: returns a structured result so the UI can show the real state.
 */
export async function verifyBrokerConnection(params: {
    broker: SupportedBroker;
    apiKey: string;
    apiSecret: string;
    apiUrl: string;
}): Promise<{ connected: boolean; error?: string }> {
    const adapter = createBrokerAdapter(params.broker);
    if (!adapter) return { connected: false, error: `Desteklenmeyen broker: ${params.broker}` };

    try {
        const connected = await adapter.connect(params.apiKey, params.apiSecret, params.apiUrl);
        return connected
            ? { connected: true }
            : { connected: false, error: 'Broker kimlik bilgileri doğrulanamadı' };
    } catch (err) {
        return {
            connected: false,
            error: err instanceof Error ? err.message : 'Broker bağlantısı kurulamadı',
        };
    }
}

/**
 * Save encrypted broker credentials for the current user.
 * Validation and URL normalisation happen before anything is written.
 */
export async function saveBrokerCredentials(params: {
    broker: string;
    apiKey: string;
    apiSecret: string;
    apiUrl?: string;
}) {
    const userId = await requireUserId();

    if (!isSupportedBroker(params.broker)) {
        throw new Error(`Desteklenmeyen broker: ${String(params.broker)}`);
    }
    const broker = params.broker;
    const apiKey = assertSecret(params.apiKey, 'API key', 512);
    const apiSecret = assertSecret(params.apiSecret, 'API secret', 512);
    const apiUrl = normalizeBrokerUrl(broker, params.apiUrl);

    await connectToDatabase();

    const encryptedApiKey = await encrypt(apiKey);
    const encryptedApiSecret = await encrypt(apiSecret);

    const doc = await BrokerCredentials.findOneAndUpdate(
        { userId },
        {
            userId,
            broker,
            apiKey: encryptedApiKey,
            apiSecret: encryptedApiSecret,
            apiUrl,
            // A stored credential is not trusted until a connection test passes.
            isConnected: false,
        },
        { upsert: true, new: true },
    );

    return {
        success: true as const,
        id: doc._id.toString(),
        broker,
        apiUrl,
        isLive: isLiveBrokerUrl(broker, apiUrl),
    };
}

/**
 * Internal use only: returns decrypted credentials for the current user.
 */
export async function getBrokerCredentials() {
    const userId = await requireUserId();
    return getBrokerCredentialsForUser(userId);
}

/**
 * Internal use only: returns decrypted credentials for a specific user.
 * Never expose the result of this function to the client.
 */
export async function getBrokerCredentialsForUser(userId: string) {
    if (!userId) return null;
    await connectToDatabase();

    const creds = await BrokerCredentials.findOne({ userId }).lean();
    if (!creds) return null;
    if (!isSupportedBroker(creds.broker)) return null;

    const decryptedApiKey = await decrypt(creds.apiKey as string);
    const decryptedApiSecret = await decrypt(creds.apiSecret as string);

    return {
        id: creds._id.toString(),
        broker: creds.broker,
        apiKey: decryptedApiKey,
        apiSecret: decryptedApiSecret,
        apiUrl: creds.apiUrl ?? '',
        isConnected: Boolean(creds.isConnected),
        lastSyncedAt: creds.lastSyncedAt ?? null,
    };
}

/**
 * Client-safe view: status only, secrets masked.
 */
export async function getBrokerSummary(): Promise<SafeBrokerSummary | null> {
    const userId = await requireUserId();
    return getBrokerSummaryForUser(userId);
}

export async function getBrokerSummaryForUser(userId: string): Promise<SafeBrokerSummary | null> {
    if (!userId) return null;
    await connectToDatabase();

    const creds = await BrokerCredentials.findOne({ userId }).lean();
    if (!creds) return null;
    if (!isSupportedBroker(creds.broker)) return null;

    let hint = '••••';
    try {
        hint = maskKey(await decrypt(creds.apiKey as string));
    } catch {
        hint = '••••';
    }

    return {
        id: creds._id.toString(),
        broker: creds.broker,
        apiUrl: creds.apiUrl ?? '',
        isLive: isLiveBrokerUrl(creds.broker, creds.apiUrl),
        isConnected: Boolean(creds.isConnected),
        lastSyncedAt: creds.lastSyncedAt ?? null,
        apiKeyHint: hint,
    };
}

/**
 * Mark broker as connected after a successful connection test.
 */
export async function markBrokerConnected(userId: string, connected: boolean) {
    if (!userId) return;
    await connectToDatabase();
    await BrokerCredentials.findOneAndUpdate(
        { userId },
        {
            isConnected: connected,
            ...(connected ? { lastSyncedAt: new Date() } : {}),
        },
    );
}

/**
 * Update the last synced timestamp for a specific credential document.
 * Call sites pass the document id, not the user id.
 */
export async function updateBrokerLastSynced(credentialsId: string) {
    assertCredentialsId(credentialsId);
    await connectToDatabase();
    await BrokerCredentials.findByIdAndUpdate(credentialsId, { lastSyncedAt: new Date() });
}
