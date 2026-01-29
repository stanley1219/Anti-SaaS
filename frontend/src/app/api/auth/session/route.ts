import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
    const refreshToken = request.cookies.get('refreshToken')?.value;
    const tenantId = request.cookies.get('tenantId')?.value;

    if (!refreshToken || !tenantId) {
        return NextResponse.json({ error: 'No session' }, { status: 401 });
    }

    try {
        // 1. Refresh to get access token
        const refreshRes = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, refreshToken }),
        });

        if (!refreshRes.ok) {
            return NextResponse.json({ error: 'Session invalid' }, { status: 401 });
        }

        const { data: tokens } = await refreshRes.json();
        const { accessToken, refreshToken: newRefreshToken } = tokens;

        // 2. Get user info
        const meRes = await fetch(`${BACKEND_URL}/api/v1/auth/me`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!meRes.ok) {
            return NextResponse.json({ error: 'Failed to fetch user' }, { status: 401 });
        }

        const { data: userData } = await meRes.json();

        const response = NextResponse.json({ accessToken, user: userData.user });

        // Set rotated refresh token cookie
        response.cookies.set('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Session restoration error', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
