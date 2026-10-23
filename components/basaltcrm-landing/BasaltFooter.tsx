import Link from 'next/link';
import Image from 'next/image';

const navigationLinks = [
    { label: 'Home', href: '/' },
    { label: 'Features', href: '/features' },
    { label: 'AI Agents', href: '/ai-agents' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Developers', href: '/developers' },
];

const exploreCategories = [
    {
        category: 'Comparisons',
        mainHref: '/compare',
        sublinks: [
            { label: 'vs Salesforce', href: '/compare/salesforce' },
            { label: 'vs HubSpot', href: '/compare/hubspot' },
            { label: 'vs Dynamics', href: '/compare/microsoft-dynamics' },
        ]
    },
    {
        category: 'Industries',
        mainHref: '/industry',
        sublinks: [
            { label: 'Real Estate', href: '/industry/real-estate' },
            { label: 'Healthcare', href: '/industry/healthcare' },
            { label: 'Legal CRM', href: '/industry/legal' },
        ]
    },
    {
        category: 'Locations',
        mainHref: '/location',
        sublinks: [
            { label: 'New York', href: '/location/new-york' },
            { label: 'London', href: '/location/london' },
            { label: 'Toronto', href: '/location/toronto' },
        ]
    }
];

const ecosystemLinks = [
    { label: 'BasaltHQ', href: 'https://basalthq.com' },
    { label: 'BasaltSURGE', href: 'https://surge.basalthq.com' },
    { label: 'BasaltERP', href: 'https://erp.basalthq.com' },
    { label: 'BasaltCMS', href: 'https://cms.basalthq.com' },
    { label: 'BasaltECHO', href: 'https://echo.basalthq.com' },
];

const socialLinks = [
    { label: 'Twitter', href: 'https://x.com/BasaltHQ' },
    { label: 'LinkedIn', href: 'https://linkedin.com/company/basalthq' },
    { label: 'GitHub', href: 'https://github.com/BasaltHQ/crm-official' },
    { label: 'Discord', href: 'https://discord.gg/G9Sp8CAQmV' },
];

export default function BasaltFooter() {
    return (
        <footer className="relative pt-6 pb-4 px-6 border-t border-white/10">
            <div className="max-w-7xl mx-auto">
                <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-8 mb-6">
                    {/* Brand Column */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="relative w-12 h-12">
                                <Image
                                    src="/CRM-ERP-CMS.png"
                                    alt="Basalt Shield"
                                    fill
                                    sizes="(max-width: 768px) 48px, 48px"
                                    className="object-contain"
                                />
                                <div className="shield-gleam-container" />
                            </div>
                            <div>
                                <span className="basalt-wordmark text-white text-xl tracking-widest" style={{ fontFamily: '"BasaltVox", "vox", sans-serif', fontSynthesis: 'none' }}>
                                    <span className="basalt-wordmark-base" style={{ fontWeight: 300 }}>BASALT</span><span className="basalt-wordmark-product" style={{ fontWeight: 700 }}>CRM</span>
                                </span>
                                <p className="text-[10px] text-cyan-500 font-mono mt-1 whitespace-nowrap">AI-POWERED RELATIONSHIPS</p>
                            </div>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            <span className="text-cyan-500 font-semibold">Your Business. Supercharged.</span> Empowering companies with autonomous AI agents that drive revenue and customer satisfaction.
                        </p>
                        <a
                            href="mailto:info@basalthq.com"
                            className="text-cyan-500 text-sm hover:underline block mb-8"
                        >
                            info@basalthq.com
                        </a>


                    </div>

                    {/* Navigation */}
                    <div>
                        <h4 className="text-xs font-mono tracking-wider text-gray-500 mb-4">NAVIGATE</h4>
                        <ul className="space-y-2">
                            {navigationLinks.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        href={link.href}
                                        className="text-gray-400 text-sm hover:text-white transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Explore */}
                    <div>
                        <h4 className="text-xs font-mono tracking-wider text-gray-500 mb-4">EXPLORE</h4>
                        <div className="space-y-6">
                            {exploreCategories.map((group) => (
                                <div key={group.category} className="space-y-2">
                                    <Link
                                        href={group.mainHref}
                                        className="text-white text-sm hover:text-cyan-500 font-medium transition-colors"
                                    >
                                        {group.category}
                                    </Link>
                                    <ul className="space-y-1.5 pl-2 border-l border-white/5">
                                        {group.sublinks.map((sublink) => (
                                            <li key={sublink.label}>
                                                <Link
                                                    href={sublink.href}
                                                    className="text-gray-400 text-xs hover:text-white transition-colors"
                                                >
                                                    {sublink.label}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Ecosystem */}
                    <div>
                        <h4 className="text-xs font-mono tracking-wider text-gray-500 mb-4">ECOSYSTEM</h4>
                        <ul className="space-y-2">
                            {ecosystemLinks.map((link) => (
                                <li key={link.label}>
                                    <a
                                        href={link.href}
                                        target={link.href.startsWith("http") ? "_blank" : undefined}
                                        rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                                        className="text-gray-400 text-sm hover:text-white transition-colors flex items-center gap-1"
                                    >
                                        {link.label}
                                        {link.href.startsWith("http") && (
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        )}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Connect */}
                    <div>
                        <h4 className="text-xs font-mono tracking-wider text-gray-500 mb-4">CONNECT</h4>
                        <ul className="space-y-2">
                            {socialLinks.map((link) => (
                                <li key={link.label}>
                                    <a
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-gray-400 text-sm hover:text-cyan-500 transition-colors"
                                    >
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>

                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-gray-500 text-xs">
                        © {new Date().getFullYear()} BasaltHQ Inc. All rights reserved.
                    </p>

                    {/* ElevenLabs Grant Badge */}
                    <div className="flex justify-center">
                        <a
                            href="https://elevenlabs.io/startup-grants"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative transition-transform duration-500 hover:scale-105"
                        >
                            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur opacity-0 group-hover:opacity-100 transition duration-500" />
                            <Image
                                src="/elevenlabs-grant.webp"
                                alt="ElevenLabs Startup Grant"
                                width={160}
                                height={40}
                                className="relative object-contain w-[140px] opacity-70 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0"
                            />
                        </a>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link href="/privacy" className="text-gray-500 text-xs hover:text-white transition-colors">
                            Privacy Policy
                        </Link>
                        <Link href="/terms" className="text-gray-500 text-xs hover:text-white transition-colors">
                            Terms of Service
                        </Link>
                        <Link href="/training-data" className="text-gray-500 text-xs hover:text-white transition-colors">
                            Training Data
                        </Link>
                        <Link href="/verify-ai" className="text-cyan-500 text-xs hover:text-white transition-colors font-mono tracking-wider">
                            Verify AI
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
