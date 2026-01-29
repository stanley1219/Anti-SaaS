import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
    const refreshToken = request.cookies.get('refreshToken')?.value;
    const tenantId = request.cookies.get('tenantId')?.value;

    if (!refreshToken || !tenantId) {
        return NextResponse.json({ error: 'Missing token or tenant context' }, { status: 401 });
    }

    try {
        const backendResponse = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tenantId, refreshToken }),
        });

        if (!backendResponse.ok) {
            return NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
        }

        const { accessToken, refreshToken: newRefreshToken } = await backendResponse.json();

        const response = NextResponse.json({ accessToken });

        // Set rotated refresh token cookie
        response.cookies.set('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Refresh proxy error', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
