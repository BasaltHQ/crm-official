'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowDown, ArrowUpRight, Check, ChevronDown, Layers3, Menu, Pause, Play, Radio, Sparkles, X } from 'lucide-react';
import { products, type ProductId } from './products';
import { ecosystem } from './ecosystem';
import ProductScene from './ProductScene';
import ScrollStory from './ScrollStory';
import './marketing.css';

type MotionControls = { paused: boolean; toggleMotion: () => void };

export default function BasaltLanding({ productId, locale, workspacePreview, portal, footer }: {
    productId: ProductId;
    locale?: string;
    workspacePreview?: ReactNode;
    portal?: ReactNode;
    footer?: ReactNode | ((controls: MotionControls) => ReactNode);
}) {
    const product = products[productId];
    const [menuOpen, setMenuOpen] = useState(false);
    const [paused, setPaused] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const menuButton = useRef<HTMLButtonElement>(null);
    const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
    const walkthrough = product.walkthrough[activeStep];
    const sceneCaptions: Record<ProductId, string> = { onyx: 'Your voice. Your audience. Your direction.', erp: 'A workshop shaped around your team.', hq: 'A family of applications. One shared direction.', cms: 'An idea. A canvas. A connected experience.', crm: 'Every connection opens a possibility.', echo: 'Good conversations have room to grow.', vigil: 'Specialist intelligence. Shared context.' };
    const href = (value: string) => locale && value.startsWith('/') && !value.startsWith('//') ? `/${locale}${value === '/' ? '' : value}` : value;

    useEffect(() => {
        if (!menuOpen) return;
        const close = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); }
        };
        const resize = () => { if (window.innerWidth > 900) setMenuOpen(false); };
        window.addEventListener('keydown', close);
        window.addEventListener('resize', resize);
        return () => { window.removeEventListener('keydown', close); window.removeEventListener('resize', resize); };
    }, [menuOpen]);

    const identity = ecosystem.find(app => app.id === productId)!;
    const brand = <span className="bm-brand"><Image src={identity.shield} alt="" width={32} height={36} /><span className="basalt-wordmark"><span className="basalt-wordmark-base">BASALT</span><strong className="basalt-wordmark-product">{product.suffix}</strong></span></span>;

    return <><div className="bm-site" data-product={productId} data-motion={paused ? 'paused' : 'playing'} style={{ '--bm-accent': product.accent } as CSSProperties}>
        <header className="bm-header">
            <a href="#bm-main" className="bm-skip">Skip to content</a>
            <div className="bm-container bm-nav">
                <Link href={href('/')} aria-label={`${product.name} home`}>{brand}</Link>
                <nav className="bm-desktop-nav" aria-label="Main navigation">{product.navigation.map(link => <Link key={link.label} href={href(link.href)}>{link.label}</Link>)}</nav>
                <div className="bm-nav-actions">
                    {product.login && <Link className="bm-login" href={href(product.login.href)}>{product.login.label}</Link>}
                    <Link className="bm-nav-cta" href={href(product.primary.href)}>{productId === 'hq' ? 'Open portal' : productId === 'erp' ? 'Book a demo' : productId === 'cms' ? 'Try the builder' : 'Get started'}<ArrowUpRight size={15} aria-hidden="true" /></Link>
                    <button ref={menuButton} className="bm-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="bm-mobile-nav" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
                </div>
            </div>
            {menuOpen && <nav id="bm-mobile-nav" className="bm-mobile-nav bm-container" aria-label="Mobile navigation">{[...product.navigation, ...(product.login ? [product.login] : [])].map(link => <Link key={link.label} href={href(link.href)} onClick={() => setMenuOpen(false)}>{link.label}<ArrowUpRight size={16} aria-hidden="true" /></Link>)}</nav>}
        </header>

        <main id="bm-main">
            <section className="bm-hero" aria-labelledby="bm-title">
                <div className="bm-stage"><ProductScene kind={product.scene} accent={product.accent} paused={paused} /><div className="bm-stage-label"><span>{product.sceneLabel}</span><span>YOUR WORK, CONNECTED</span></div><div className="bm-stage-caption"><span className="bm-dot" /><span>{sceneCaptions[productId]}</span><button type="button" aria-label={paused ? 'Resume motion' : 'Pause motion'} aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}</button></div></div>
                <div className="bm-hero-shade" aria-hidden="true" />
                <div className="bm-container bm-hero-layout">
                    <div className="bm-hero-copy"><p className="bm-eyebrow"><span className="bm-dot" />{product.eyebrow}</p><h1 id="bm-title">{product.headline}<br /><span>{product.highlight}</span></h1><p className="bm-description">{product.description}</p><p className="bm-detail">{product.detail}</p><div className="bm-actions"><Link href={href(product.primary.href)} className="bm-primary">{product.primary.label}<ArrowUpRight size={18} aria-hidden="true" /></Link><Link href={href(product.secondary.href)} className="bm-text-link">{product.secondary.label}<ArrowUpRight size={16} aria-hidden="true" /></Link></div><div className="bm-hero-notes">{product.notes.map(note => <span key={note}><Check size={14} aria-hidden="true" />{note}</span>)}</div></div>
                </div>
                <div className="bm-container bm-rail"><p>Purpose-built intelligence.<br /><strong>Real-world possibilities.</strong></p>{product.rails.map((rail, index) => <div key={rail}>{index === 0 ? <Radio size={21} aria-hidden="true" /> : index === 1 ? <Layers3 size={21} aria-hidden="true" /> : <Sparkles size={21} aria-hidden="true" />}<span>{rail}</span></div>)}</div>
                <a className="bm-scroll" href="#story"><span>Scroll to unfold the story</span><ArrowDown size={17} aria-hidden="true" /></a>
            </section>

            {portal && <div className="bm-native-section">{portal}</div>}

            <ScrollStory productId={productId} paused={paused} toggleMotion={() => setPaused(value => !value)} />

            <section className="bm-container bm-section" id="platform" aria-labelledby="bm-platform-title"><div className="bm-section-heading"><div><p className="bm-eyebrow">LESS FRICTION. MORE POSSIBILITY.</p><h2 id="bm-platform-title">{product.featuresTitle}</h2></div><p>{product.featuresDetail}</p></div><div className="bm-features">{product.features.map((feature, index) => <article key={feature.label}><div className="bm-feature-top"><span>{index === 0 ? <Radio size={26} strokeWidth={1.4} aria-hidden="true" /> : index === 1 ? <Layers3 size={26} strokeWidth={1.4} aria-hidden="true" /> : <Sparkles size={26} strokeWidth={1.4} aria-hidden="true" />}</span><span>0{index + 1}</span></div><p className="bm-small-label">{feature.label}</p><h3>{feature.title}</h3><p>{feature.description}</p></article>)}</div></section>

            <section id="capabilities" className="bm-product-section" aria-labelledby="bm-preview-title"><div className="bm-container bm-product-layout"><div className="bm-product-copy"><p className="bm-eyebrow">A LOOK INSIDE / YOUR NEXT MOVE</p><h2 id="bm-preview-title">Familiar on the surface.<br /><span>Powerful underneath.</span></h2><p>A little context changes what happens next. Explore the workflow, then make it your own.</p><Link href={href(product.primary.href)} className="bm-text-link">{product.primary.label}<ArrowUpRight size={17} aria-hidden="true" /></Link></div><div className="bm-preview"><div className="bm-preview-top"><span><span className="bm-dot" />{product.name} / WORKSPACE</span><span>ILLUSTRATIVE WALKTHROUGH</span></div><div className="bm-tabs" role="tablist" aria-label="Product walkthrough">{product.walkthrough.map((step, index) => <button ref={element => { tabButtons.current[index] = element; }} key={step.label} id={`bm-tab-${index}`} type="button" role="tab" aria-selected={activeStep === index} aria-controls="bm-preview-panel" tabIndex={activeStep === index ? 0 : -1} onClick={() => setActiveStep(index)} onKeyDown={event => {
                        let next = index;
                        if (event.key === 'ArrowRight') next = (index + 1) % product.walkthrough.length;
                        else if (event.key === 'ArrowLeft') next = (index + product.walkthrough.length - 1) % product.walkthrough.length;
                        else if (event.key === 'Home') next = 0;
                        else if (event.key === 'End') next = product.walkthrough.length - 1;
                        else return;
                        event.preventDefault(); setActiveStep(next); tabButtons.current[next]?.focus();
                    }}>{step.label}</button>)}</div><div className="bm-preview-panel" id="bm-preview-panel" role="tabpanel" aria-labelledby={`bm-tab-${activeStep}`} tabIndex={0}><span className="bm-small-label">0{activeStep + 1} / {walkthrough.label}</span><h3>{walkthrough.title}</h3><p>{walkthrough.detail}</p><div className="bm-preview-rows">{walkthrough.rows.map(([label, value], index) => <div key={label}><span className="bm-row-icon">{index === 0 ? <Radio size={15} aria-hidden="true" /> : index === 1 ? <Layers3 size={15} aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}</span><strong>{label}</strong><span>{value}</span></div>)}</div><div className="bm-preview-note"><Check size={14} aria-hidden="true" />{walkthrough.note}</div></div></div></div></section>

            {workspacePreview && <section className="bm-container bm-section bm-onyx-preview" aria-label="Onyx command center preview">{workspacePreview}</section>}

            <section id="workflow" className="bm-container bm-section" aria-labelledby="bm-workflow-title"><div className="bm-workflow"><div><p className="bm-eyebrow">FROM INTENT TO ACTION</p><h2 id="bm-workflow-title">{product.workflowTitle}</h2><p>{product.workflowDetail}</p><Link href={href(product.primary.href)} className="bm-text-link">Find your starting point<ArrowUpRight size={17} aria-hidden="true" /></Link></div><ol>{product.steps.map(([title, detail], index) => <li key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{detail}</p></div></li>)}</ol></div></section>

            <section className="bm-spotlight" id={productId === 'crm' ? 'tools' : 'possibilities'} aria-labelledby="bm-spotlight-title"><div className="bm-container bm-spotlight-layout"><div><p className="bm-eyebrow">{product.spotlight.label}</p><h2 id="bm-spotlight-title">{product.spotlight.title}</h2></div><div><p>{product.spotlight.description}</p><div className="bm-spotlight-links">{product.spotlight.links.map(link => <Link key={link.href} href={href(link.href)} className="bm-secondary">{link.label}<ArrowUpRight size={17} aria-hidden="true" /></Link>)}</div></div></div></section>

            <section id="ecosystem" className="bm-container bm-section" aria-labelledby="bm-family-title"><div className="bm-section-heading"><div><p className="bm-eyebrow">THE BASALT FAMILY / ONE SHARED DIRECTION</p><h2 id="bm-family-title">Different strengths.<br /><span>Connected possibilities.</span></h2></div><p>Purpose-built applications.<br />A consistent experience.<br />Find your next starting point.</p></div><div className="bm-family-grid">{ecosystem.map(app => <a key={app.id} href={app.href} className="bm-family-card" aria-label={`${app.name}: ${app.detail}`} aria-current={app.id === productId ? 'page' : undefined} style={{ '--app-accent': app.accent } as CSSProperties}><div><Image className="bm-family-mark" src={app.shield} alt="" width={44} height={48} /><ArrowUpRight size={17} aria-hidden="true" /></div><h3 className="basalt-wordmark"><span className="basalt-wordmark-base">BASALT</span><strong className="basalt-wordmark-product">{app.suffix}</strong></h3><p>{app.detail}</p><span className="bm-family-label">{app.id === productId ? 'YOU ARE HERE' : 'EXPLORE THE PRODUCT'}</span></a>)}</div></section>

            <section id="questions" className="bm-container bm-section bm-faq" aria-labelledby="bm-questions-title"><div><p className="bm-eyebrow">A LITTLE MORE CLARITY</p><h2 id="bm-questions-title">Good questions.<br />Straight answers.</h2></div><div>{product.questions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>

            <section className="bm-final" aria-labelledby="bm-final-title"><div className="bm-container"><p className="bm-eyebrow">YOUR NEXT CHAPTER STARTS HERE</p><h2 id="bm-final-title">{product.finalTitle}<br /><span>{product.finalHighlight}</span></h2><p>Bring the {product.name} experience to your business.</p><div className="bm-actions"><Link href={href(product.primary.href)} className="bm-primary">{product.primary.label}<ArrowUpRight size={18} aria-hidden="true" /></Link>{productId === 'crm' && <a className="bm-text-link" href="https://calendar.google.com/appointments/schedules/AcZssZ2Vduqr0QBnEAM50SeixE8a7kXuKt62zEFjQCQ8_xvoO6iF3hluVQHpaM6RYWMGB110_zM3MUF0" target="_blank" rel="noopener noreferrer">Schedule a call<ArrowUpRight size={16} aria-hidden="true" /></a>}</div></div></section>
        </main>

    </div>{typeof footer === 'function' ? footer({ paused, toggleMotion: () => setPaused(value => !value) }) : footer}</>;
}
