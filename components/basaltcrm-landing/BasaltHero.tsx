import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Search, Mail, Gift } from "lucide-react";
import FluidNeuralWave from "@/app/components/FluidNeuralWave";

export default function BasaltHero() {
    return (
        <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center pt-28 md:pt-32 lg:pt-36 pb-20 px-6 overflow-hidden">
            {/* The Neural Background */}
            <div className="absolute inset-0 z-0">
                <FluidNeuralWave className="opacity-40" />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center w-full max-w-6xl mb-16 sm:mb-24 md:mb-0">
                {/* Status Indicator */}
                <div className="inline-flex items-center gap-3 mb-10 px-5 py-2.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-md opacity-0 animate-fadeInUp">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </span>
                    <span className="text-[9px] md:text-[10px] font-mono tracking-[0.4em] text-cyan-400 uppercase">
                        SYSTEM OPERATIONAL // CORE ONLINE
                    </span>
                </div>

                {/* Main Heading - Billboard Style */}
                <div className="relative mb-10 opacity-0 animate-fadeInUp stagger-1">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-r from-cyan-500/20 via-fuchsia-500/10 to-violet-500/20 blur-[100px] rounded-full z-0 pointer-events-none" />
                    <h1 className="relative z-10 text-6xl sm:text-7xl md:text-8xl lg:text-[9rem] font-black tracking-tighter leading-[0.95] uppercase opacity-[0.85]">
                        <span className="block text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] pb-1">
                            TOTAL
                        </span>
                        <span className="block bg-gradient-to-r from-cyan-400 via-white to-violet-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(34,211,238,0.4)] pb-4 relative z-10">
                            AGENCY
                        </span>
                    </h1>
                </div>

                {/* Mission Statement */}
                <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-6 leading-relaxed opacity-0 animate-fadeInUp stagger-2 font-light">
                    Move beyond management. Deploy performance. <br className="hidden md:block" />
                    <span className="text-white font-medium">BasaltCRM</span> is the first end-to-end autonomous <span className="text-white">AI-ASSISTED STACK</span>.
                    From infrastructure provisioning to AI closing, we build the loop that never sleeps.
                </p>

                {/* Conversion Subtitle */}
                <p className="text-base md:text-lg text-cyan-400/80 max-w-2xl mx-auto mb-12 leading-relaxed opacity-0 animate-fadeInUp stagger-2 font-mono tracking-wide">
                    Jev Decision Intelligence • AI-powered lead generation • Automated outreach • Free signature &amp; form builders — <span className="text-white font-semibold">starting at $0/mo</span>
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 opacity-0 animate-fadeInUp stagger-3">
                    <Link
                        href="https://calendar.google.com/appointments/schedules/AcZssZ2Vduqr0QBnEAM50SeixE8a7kXuKt62zEFjQCQ8_xvoO6iF3hluVQHpaM6RYWMGB110_zM3MUF0"
                        target="_blank"
                        className="group relative h-16 px-10 flex items-center justify-center text-base font-bold tracking-wider rounded-2xl bg-white text-black hover:bg-cyan-400 transition-colors duration-500 overflow-hidden"
                    >
                        <span className="relative z-10 flex items-center">
                            SCHEDULE A CALL
                            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    <Link
                        href="/features"
                        className="h-16 px-10 flex items-center justify-center text-base font-bold tracking-wider rounded-2xl border border-white/20 text-white hover:bg-white/10 hover:border-white/40 transition-colors duration-300 backdrop-blur-xl"
                    >
                        SYSTEM SPECS
                    </Link>
                </div>

                {/* Infrastructure Tags */}
                <div className="mt-12 flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 opacity-0 animate-fadeInUp stagger-4 px-4">
                    <div className="group relative flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 overflow-hidden transition-colors duration-500 hover:border-cyan-500/50 hover:bg-cyan-500/5">
                        <div className="absolute -bottom-4 -right-4 opacity-10 group-hover:opacity-40 transition-[opacity,transform] duration-700 pointer-events-none group-hover:scale-150 group-hover:-rotate-12">
                            <Search className="h-16 w-16 text-cyan-400" />
                        </div>
                        <span className="relative z-10 text-[9px] md:text-[10px] font-mono text-gray-500 group-hover:text-cyan-400 transition-colors uppercase tracking-widest">AI LEAD GENERATION</span>
                    </div>

                    <div className="group relative flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 overflow-hidden transition-colors duration-500 hover:border-violet-500/50 hover:bg-violet-500/5">
                        <div className="absolute -bottom-4 -right-4 opacity-10 group-hover:opacity-40 transition-[opacity,transform] duration-700 pointer-events-none group-hover:scale-150 group-hover:-rotate-12">
                            <Mail className="h-16 w-16 text-violet-400" />
                        </div>
                        <span className="relative z-10 text-[9px] md:text-[10px] font-mono text-gray-500 group-hover:text-violet-400 transition-colors uppercase tracking-widest">AUTOMATED OUTREACH</span>
                    </div>

                    <div className="group relative flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 overflow-hidden transition-colors duration-500 hover:border-emerald-500/50 hover:bg-emerald-500/5">
                        <div className="absolute -bottom-4 -right-4 opacity-10 group-hover:opacity-40 transition-[opacity,transform] duration-700 pointer-events-none group-hover:scale-150 group-hover:-rotate-12">
                            <Gift className="h-16 w-16 text-emerald-400" />
                        </div>
                        <span className="relative z-10 text-[9px] md:text-[10px] font-mono text-gray-500 group-hover:text-emerald-400 transition-colors uppercase tracking-widest">FREE BUSINESS TOOLS</span>
                    </div>
                </div>
            </div>


        </section>
    );
}
