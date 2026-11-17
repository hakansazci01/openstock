import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface IAuditLog extends Document {
    userId: string;
    userEmail?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
    {
        userId: { type: String, required: true, index: true },
        userEmail: { type: String, default: '' },
        action: { type: String, required: true },
        resource: { type: String, required: true },
        resourceId: { type: String },
        details: { type: Schema.Types.Mixed, default: {} },
        ipAddress: { type: String },
        userAgent: { type: String },
    },
    { timestamps: true }
);

AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
    (models?.AuditLog as Model<IAuditLog>) || model<IAuditLog>('AuditLog', AuditLogSchema);