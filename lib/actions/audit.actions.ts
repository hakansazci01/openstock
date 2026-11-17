'use server';

import { AuditLog } from '@/database/models/audit.log.model';
import { getSession } from '@/lib/better-auth/auth';

export async function logAuditAction(params: {
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
}) {
    try {
        const session = await getSession().catch(() => null);
        const userId = session?.user?.id ?? 'unknown';
        const userEmail = session?.user?.email ?? '';

        try {
            await AuditLog.create({
                userId,
                userEmail,
                action: params.action,
                resource: params.resource,
                resourceId: params.resourceId,
                details: params.details ?? {},
            });
        } catch {
            // DB unavailable or test environment - silently skip audit log
        }
    } catch {
        // Auth unavailable - silently skip audit log
    }
}