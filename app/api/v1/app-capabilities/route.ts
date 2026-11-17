import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        capabilities: [],
        version: '1.0.0',
    });
}