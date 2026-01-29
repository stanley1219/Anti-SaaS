'use client';

import { useRouter } from 'next/navigation';

export default function NotFound() {
    const router = useRouter();

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                textAlign: 'center',
                padding: '2rem',
            }}
        >
            <h1 style={{ fontSize: '2rem', fontWeight: 600 }}>
                404 – Page not found
            </h1>

            <p style={{ maxWidth: '420px', color: '#666' }}>
                The page you’re trying to access doesn’t exist or was moved.
            </p>

            <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                    onClick={() => router.push('/dashboard')}
                    style={{
                        padding: '0.6rem 1.2rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#000',
                        color: '#fff',
                        cursor: 'pointer',
                    }}
                >
                    Go to Dashboard
                </button>

                <button
                    onClick={() => router.push('/login')}
                    style={{
                        padding: '0.6rem 1.2rem',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                        background: '#fff',
                        cursor: 'pointer',
                    }}
                >
                    Login
                </button>
            </div>
        </div>
    );
}