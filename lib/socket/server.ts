/**
 * Socket.IO Sunucu Kurulumu
 * Gerçek zamanlı fiyat güncellemeleri için WebSocket sunucusu.
 * Next.js App Router ile birlikte çalışacak şekilde yapılandırılmıştır.
 */

import { Server as IOServer, type Socket } from 'socket.io';
import { createServer } from 'http';
import { isRateLimited } from '@/lib/rate-limit';

// Price update broadcaster - connected clients'a fiyat güncellemelerini yayar
class PriceBroadcaster {
    private io: IOServer | null = null;
    private subscribedClients = new Set<string>(); // clientId -> subscribed symbols

    init(httpServer: ReturnType<typeof createServer>) {
        this.io = new IOServer(httpServer, {
            cors: {
                origin: process.env.NEXTAUTH_URL || process.env.BETTER_AUTH_URL || '*',
                methods: ['GET', 'POST'],
                credentials: true,
            },
            path: '/api/socket.io',
        });

        this.io.on('connection', (socket: Socket) => {
            console.log(`[Socket.IO] Client connected: ${socket.id}`);

            socket.on('subscribe', (symbol: string) => {
                if (!this.subscribedClients.has(socket.id)) {
                    this.subscribedClients.add(socket.id);
                }
                socket.join(`symbol:${symbol.toUpperCase()}`);
                console.log(`[Socket.IO] ${socket.id} subscribed to ${symbol}`);
            });

            socket.on('unsubscribe', (symbol: string) => {
                socket.leave(`symbol:${symbol.toUpperCase()}`);
                console.log(`[Socket.IO] ${socket.id} unsubscribed from ${symbol}`);
            });

            socket.on('disconnect', () => {
                console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
                this.subscribedClients.delete(socket.id);
            });
        });
    }

    /**
     * Belirli bir sembol için fiyat güncellesini ilgili clientlara gönderir
     */
    broadcastPrice(symbol: string, price: number, change: number, changePercent: number) {
        if (!this.io) return;
        this.io.to(`symbol:${symbol.toUpperCase()}`).emit('priceUpdate', {
            symbol: symbol.toUpperCase(),
            price,
            change,
            changePercent,
            timestamp: new Date().toISOString(),
        });
    }

    getIO() {
        return this.io;
    }
}

export const priceBroadcaster = new PriceBroadcaster();
