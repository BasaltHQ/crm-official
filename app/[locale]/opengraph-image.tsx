import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'BasaltCRM - AI Sales & Support Engine'
export const size = {
    width: 1200,
    height: 630,
}

export const contentType = 'image/png'

export default async function Image() {
    // Using a robust fallback validation for the image URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm.basalthq.com';
    const logoUrl = new URL('/BasaltCRMWideD.png', baseUrl).toString();

    return new ImageResponse(
        (
            <div
                style={{
                    background: 'linear-gradient(135deg, #020617 0%, #0F172A 100%)',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'sans-serif',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Decorative Grid Background */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: `
              linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
            `,
                        backgroundSize: '50px 50px',
                        maskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)',
                    }}
                />

                {/* Central Glow */}
                <div
                    style={{
                        position: 'absolute',
                        width: '800px',
                        height: '800px',
                        background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, rgba(59,130,246,0.05) 30%, transparent 70%)',
                        filter: 'blur(40px)',
                        borderRadius: '50%',
                        opacity: 0.8,
                    }}
                />

                {/* Content Container */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10, gap: 20 }}>
                    {/* Logo */}
                    <img
                        src={logoUrl}
                        alt="BasaltCRM"
                        width={600}
                        height={150}
                        style={{ objectFit: 'contain' }}
                    />

                    {/* Tagline */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginTop: 10,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 48,
                                fontWeight: 800,
                                background: 'linear-gradient(to right, #ffffff, #94a3b8)',
                                backgroundClip: 'text',
                                color: 'transparent',
                                textAlign: 'center',
                                letterSpacing: '-0.02em',
                                marginBottom: 10,
                            }}
                        >
                            AI Sales & Support Engine
                        </div>
                        <div
                            style={{
                                fontSize: 24,
                                color: '#64748B',
                                textAlign: 'center',
                                maxWidth: 800,
                                lineHeight: 1.4,
                            }}
                        >
                            Automated prospecting, social intelligence, and 24/7 AI agents that never sleep.
                        </div>
                    </div>
                </div>

                {/* Footer / Brand Element */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 40,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 24px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '100px',
                        border: '1px solid rgba(255,255,255,0.05)',
                    }}
                >
                    <div style={{ width: 8, height: 8, background: '#06B6D4', borderRadius: '50%', boxShadow: '0 0 10px #06B6D4' }} />
                    <div style={{ fontSize: 16, color: '#94A3B8', fontWeight: 500, letterSpacing: '0.05em' }}>
                        CRM.BASALTHQ.COM
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
        }
    )
}
