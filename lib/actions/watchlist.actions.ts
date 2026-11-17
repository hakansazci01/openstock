'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Watchlist } from '@/database/models/watchlist.model';
import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/better-auth/auth';

const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.&:-]{0,24}$/;
const MAX_WATCHLIST = 50;

export async function addToWatchlist(symbol: string, company: string) {
    const userId = await requireUserId();
    const ticker = String(symbol ?? '').trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(ticker)) throw new Error('Invalid symbol');
    const name = String(company ?? '').trim().slice(0, 120);
    try {
        await connectToDatabase();

        if (!(await Watchlist.exists({ userId, symbol: ticker })) && (await Watchlist.countDocuments({ userId })) >= MAX_WATCHLIST) {
            return { error: `Your watchlist is full (${MAX_WATCHLIST} stocks). Remove one to add another.` };
        }

        const newItem = await Watchlist.findOneAndUpdate(
            { userId, symbol: ticker },
            { userId, symbol: ticker, company: name, addedAt: new Date() },
            { upsert: true, new: true }
        );

        revalidatePath('/', 'layout');

        return JSON.parse(JSON.stringify(newItem));
    } catch (error) {
        console.error('Error adding to watchlist:', error);
        throw new Error('Failed to add to watchlist');
    }
}

export async function removeFromWatchlist(symbol: string) {
    const userId = await requireUserId();
    try {
        await connectToDatabase();
        await Watchlist.findOneAndDelete({ userId, symbol: symbol.toUpperCase() });
        revalidatePath('/', 'layout');

        return { success: true };
    } catch (error) {
        console.error('Error removing from watchlist:', error);
        throw new Error('Failed to remove from watchlist');
    }
}

export async function getUserWatchlist() {
    const userId = await requireUserId();
    try {
        await connectToDatabase();
        const watchlist = await Watchlist.find({ userId }).sort({ addedAt: -1 });
        return JSON.parse(JSON.stringify(watchlist));
    } catch (error) {
        console.error('Error fetching watchlist:', error);
        return [];
    }
}

export async function isStockInWatchlist(symbol: string) {
    const userId = await requireUserId();
    try {
        await connectToDatabase();
        const item = await Watchlist.findOne({ userId, symbol: symbol.toUpperCase() });
        return !!item;
    } catch (error) {
        console.error('Error checking watchlist status:', error);
        return false;
    }
}