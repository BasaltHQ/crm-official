'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, Pause, Play } from 'lucide-react';
import ProductScene from './ProductScene';
import { stories } from './stories';
import { products, type ProductId } from './products';

export default function ScrollStory({ productId, paused, toggleMotion }: { productId: ProductId; paused: boolean; toggleMotion: () => void }) {
    const story = stories[productId], product = products[productId];
    const root = useRef<HTMLElement>(null), stage = useRef<HTMLDivElement>(null);
    const progress = useRef(0);
    const [chapter, setChapter] = useState(0);

    useEffect(() => {
        const section = root.current, visual = stage.current;
        if (!section || !visual) return;
        const chapters = Array.from(section.querySelectorAll<HTMLElement>('.bm-story-chapter'));
        let frame = 0, first = 0, last = 1, disposed = false;
        const update = () => {
            frame = 0;
            if (disposed) return;
            const value = Math.max(0, Math.min(1, (window.scrollY - first) / Math.max(1, last - first)));
            if (Math.abs(value - progress.current) < .0001) return;
            progress.current = value;
            section.style.setProperty('--bm-story-progress', String(value));
            section.dataset.progress = value.toFixed(3);
            setChapter(Math.round(value * 3));
            window.dispatchEvent(new CustomEvent('basalt-scene-progress', { detail: progress }));
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
        const measure = () => {
            const measuredTop = parseFloat(getComputedStyle(visual).top);
            const top = Number.isFinite(measuredTop) ? measuredTop : 0;
            const anchor = top + visual.offsetHeight * .5;
            const pagePadding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
            section.style.setProperty('--bm-story-anchor', `${anchor - chapters[0].offsetHeight / 2 - pagePadding}px`);
            const stops = chapters.map(element => element.getBoundingClientRect().top + scrollY + element.offsetHeight / 2 - anchor);
            first = stops[0]; last = stops[3]; schedule();
        };
        const resize = new ResizeObserver(measure); resize.observe(section); resize.observe(visual);
        // Font metrics can move the chapter centers after the initial layout.
        void document.fonts.ready.then(() => { if (!disposed) measure(); });
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', measure);
        measure();
        return () => { disposed = true; cancelAnimationFrame(frame); resize.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', measure); };
    }, [productId]);

    const active = story.chapters[chapter];
    return <section ref={root} id="story" className="bm-story" data-chapter={chapter} data-progress="0" aria-labelledby="bm-story-title">
        <div className="bm-container bm-story-intro">
            <div><p className="bm-eyebrow">{product.name.toUpperCase()} / THE STORY IN MOTION</p><h2 id="bm-story-title">{story.title}</h2><p>{story.introduction}</p></div>
            <div className="bm-story-guide"><span><ArrowDown size={15} aria-hidden="true" />Scroll to unfold the story</span><a href="#platform">Explore the platform<ArrowUpRight size={14} aria-hidden="true" /></a></div>
        </div>
        <div className="bm-story-body">
            <div ref={stage} className="bm-story-stage">
                <div className="bm-story-stage-top"><span><span className="bm-dot" />{active.label}</span><span>0{chapter + 1} / 04</span><button type="button" aria-label={paused ? 'Resume story motion' : 'Pause story motion'} aria-pressed={paused} onClick={toggleMotion}>{paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}</button></div>
                <ProductScene kind={product.scene} accent={product.accent} paused={paused} progress={progress} />
                <div className="bm-story-caption"><p>{active.visual}</p><div className="bm-story-tags">{active.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
                <nav className="bm-story-stops" aria-label={`${product.name} story chapters`}>{story.chapters.map((step, index) => <a key={step.label} href={`#story-chapter-${index}`} aria-label={`Chapter ${index + 1}: ${step.label}`} aria-current={chapter === index ? 'step' : undefined}><span>0{index + 1}</span><span>{step.label}</span></a>)}</nav>
                <div className="bm-story-progress" aria-hidden="true"><span /></div>
            </div>
            <div className="bm-story-chapters">{story.chapters.map((step, index) => <article id={`story-chapter-${index}`} key={step.label} className="bm-story-chapter" data-active={chapter === index} aria-labelledby={`story-title-${index}`}><div className="bm-container"><div className="bm-story-prose"><span className="bm-story-number">0{index + 1} / {step.label.toUpperCase()}</span><h3 id={`story-title-${index}`}>{step.title}</h3><p>{step.detail}</p><span className="bm-story-chapter-rule" aria-hidden="true" /></div></div></article>)}</div>
        </div>
    </section>;
}
