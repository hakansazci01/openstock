'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

interface PriceUpdate {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    timestamp: string;
}

interface UseSocketPriceOptions {
    symbols: string[];
    onPriceUpdate?: (update: PriceUpdate) => void;
    enabled?: boolean;
}

/**
 * Gerçek zamanlı fiyat güncellemeleri için Socket.IO hook'u.
 * Sunucuya bağlanıp belirli semboller için fiyat güncellemelerini dinler.
 */
export function useSocketPrice({ symbols, onPriceUpdate, enabled = true }: UseSocketPriceOptions) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<PriceUpdate | null>(null);

    const updateCallback = useCallback((update: PriceUpdate) => { onPriceUpdate?.(update); }, [onPriceUpdate]);

    useEffect(() => {
        if (!enabled || !symbols.length) return;

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000';

        const socketInstance = io(socketUrl, {
            path: '/api/socket.io',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            auth: {
                symbols: symbols.join(','),
            },
        });

        socketInstance.on('connect', () => {
            setIsConnected(true);
            // Tüm sembollere abone ol
            symbols.forEach((symbol) => {
                socketInstance.emit('subscribe', symbol);
            });
        });

        socketInstance.on('disconnect', () => {
            setIsConnected(false);
        });

        socketInstance.on('priceUpdate', (update: PriceUpdate) => {
            setLastUpdate(update);
            updateCallback?.(update);
        });

        socketInstance.on('connect_error', (err) => {
            console.warn('[Socket.IO] Connection error:', err.message);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
            setSocket(null);
            setIsConnected(false);
        };
    }, [enabled, symbols.join(','), updateCallback]);

    return {
        socket,
        isConnected,
        lastUpdate,
        subscribe: (symbol: string) => {
            socket?.emit('subscribe', symbol);
        },
        unsubscribe: (symbol: string) => {
            socket?.emit('unsubscribe', symbol);
        },
    };
}
