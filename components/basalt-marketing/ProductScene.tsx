'use client';

import { useEffect, useRef, useState, useId, type RefObject } from 'react';
import type { SceneKind } from './products';
import type { CoreRenderer } from './scene-renderer';
import SceneFallback from './WorldFallback';
import { sceneLabels } from './scene-choreography';

const heroPose: Record<SceneKind, number> = { network: .18, crystal: .36, constellation: .6, modules: .48, pages: .42, wave: .35, shield: .50 };

export default function ProductScene({ kind, accent, paused, progress = heroPose[kind] }: { kind: SceneKind; accent: string; paused: boolean; progress?: number | RefObject<number> }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const stage = useRef<HTMLDivElement>(null);
    const annotations = useRef<HTMLDivElement>(null);
    const pausedRef = useRef(paused);
    const progressRef = useRef(progress);
    const [rendererState, setRendererState] = useState('fallback');
    const [fallbackChapter, setFallbackChapter] = useState(typeof progress === 'number' ? Math.round(progress * 3) : 0);
    const gradient = useId().replace(/:/g, '');

    useEffect(() => { pausedRef.current = paused; window.dispatchEvent(new Event('basalt-marketing-motion')); }, [paused]);
    useEffect(() => { progressRef.current = progress; }, [progress]);

    useEffect(() => {
        const element = canvas.current, container = stage.current;
        if (!element || !container) return;
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const labels = new Map(Array.from(annotations.current?.children || []).map(element => [element.getAttribute('data-label'), element as HTMLElement]));
        let renderer: CoreRenderer | null = null, frame = 0, disposed = false, visible = false, dirty = true;
        let lastFrame = 0, elapsed = 0, generation = 0, attempted = false, renderedProgress = typeof progressRef.current === 'number' ? progressRef.current : progressRef.current.current ?? 0;
        const readProgress = () => typeof progressRef.current === 'number' ? progressRef.current : progressRef.current.current ?? 0;
        const tick = (now: number) => {
            frame = 0;
            if (disposed || !visible || document.hidden || !renderer) { lastFrame = 0; return; }
            const frozen = media.matches || pausedRef.current;
            const interval = window.innerWidth <= 800 ? 1000 / 30 : 1000 / 45;
            if (dirty || now - lastFrame >= interval) {
                if (lastFrame && !frozen) elapsed += Math.min((now - lastFrame) / 1000, .08);
                if (!pausedRef.current) renderedProgress = media.matches ? Math.round(readProgress() * 3) / 3 : readProgress();
                const projected = renderer.render(renderedProgress, elapsed, media.matches);
                for (const label of projected) {
                    const node = labels.get(label.id);
                    if (!node) continue;
                    node.style.transform = `translate(${label.x}px,${label.y}px) translate(-50%,-100%)`;
                    node.style.opacity = String(label.opacity);
                    node.textContent = label.text;
                }
                container.dataset.progress = renderedProgress.toFixed(3);
                container.dataset.motionMode = media.matches ? 'still' : pausedRef.current ? 'paused' : 'playing';
                lastFrame = now; dirty = false;
            }
            if (!frozen) frame = requestAnimationFrame(tick);
        };
        function start() { if (!frame && renderer && visible && !document.hidden && !disposed) frame = requestAnimationFrame(tick); }
        const wake = () => { if (!pausedRef.current) setFallbackChapter(Math.round(readProgress() * 3)); dirty = true; lastFrame = 0; start(); };
        const scrollProgress = (event: Event) => {
            if ((event as CustomEvent).detail !== progressRef.current || pausedRef.current) return;
            const chapter = Math.round(readProgress() * 3);
            setFallbackChapter(chapter);
            // Progress is sampled on the next scheduled frame. Resetting the
            // clock for every scroll event bypasses the frame cap and prevents
            // secondary motion from advancing during a continuous scroll.
            if (media.matches) {
                if (chapter / 3 !== renderedProgress) { dirty = true; start(); }
            } else start();
        };
        const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting && entry.intersectionRatio > .12;
            if (!visible) { cancelAnimationFrame(frame); frame = 0; lastFrame = 0; } else { if (!attempted) initialize(); wake(); }
        }, { threshold: [0, .12] });
        observer.observe(container);
        const resize = new ResizeObserver(wake); resize.observe(container);
        const contextLost = (event: Event) => {
            if (disposed) return;
            event.preventDefault(); generation++; setRendererState('fallback'); cancelAnimationFrame(frame); frame = 0; renderer?.dispose(false); renderer = null;
        };
        const initialize = () => {
            attempted = true;
            const current = ++generation;
            void import('./scene-renderer').then(({ createCoreRenderer }) => {
                if (disposed || current !== generation) return;
                renderer = createCoreRenderer(element, kind, accent);
                setRendererState(renderer ? 'webgl' : 'fallback'); wake();
            }).catch(() => { if (!disposed) setRendererState('fallback'); });
        };
        const restore = () => { if (disposed) return; renderer?.dispose(false); renderer = null; initialize(); };
        document.addEventListener('visibilitychange', wake);
        window.addEventListener('basalt-marketing-motion', wake);
        window.addEventListener('basalt-scene-progress', scrollProgress);
        media.addEventListener('change', wake);
        element.addEventListener('webglcontextlost', contextLost);
        element.addEventListener('webglcontextrestored', restore);
        return () => {
            disposed = true; generation++; cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect(); renderer?.dispose();
            document.removeEventListener('visibilitychange', wake); window.removeEventListener('basalt-marketing-motion', wake); window.removeEventListener('basalt-scene-progress', scrollProgress);
            media.removeEventListener('change', wake); element.removeEventListener('webglcontextlost', contextLost); element.removeEventListener('webglcontextrestored', restore);
        };
    }, [kind, accent]);

    return <div ref={stage} className="bm-scene" data-layout="immersive" data-renderer={rendererState} data-scene={kind} aria-hidden="true">
        <svg className="bm-scene-fallback" viewBox="0 0 600 600" fill="none">
            <defs><linearGradient id={gradient} x1="170" y1="100" x2="430" y2="490" gradientUnits="userSpaceOnUse"><stop stopColor={accent} stopOpacity=".45" /><stop offset=".5" stopColor="#6b5935" /><stop offset="1" stopColor="#21180f" /></linearGradient></defs>
            <SceneFallback kind={kind} chapter={fallbackChapter} gradient={gradient} />
        </svg>
        <canvas ref={canvas} />
        {typeof progress !== 'number' && <div ref={annotations} className="bm-scene-annotations">{Object.entries(sceneLabels[kind]).map(([id, text]) => <span key={id} data-label={id}>{text}</span>)}<span className="bm-scene-dialogue" data-label="scene-caption" /></div>}
    </div>;
}
