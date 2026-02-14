"use client";

import Link from "next/link";
import { MoveLeft, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import GeometricBackground from "@/app/components/GeometricBackground";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body>
                <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background text-foreground font-sans">
                    {/* Background */}
                    <div className="absolute inset-0 z-0">
                        <GeometricBackground />
                    </div>

                    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 text-center">
                        {/* Error Code with Glow */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="relative mb-8"
                        >
                            <h1 className="text-[10rem] md:text-[14rem] font-black tracking-tighter leading-none select-none text-white/5">
                                500
                            </h1>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <AlertTriangle className="w-20 h-20 text-red-500 mb-4 animate-pulse" />
                                <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-900 drop-shadow-2xl">
                                    SYSTEM FAILURE
                                </h2>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="max-w-2xl space-y-8"
                        >
                            <div className="space-y-4">
                                <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-white uppercase font-mono">
                                    <span className="text-red-500 mr-2">/</span> Critical Error Detected
                                </h3>
                                <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-lg mx-auto">
                                    A critical system malfunction has occurred. The neural network has encountered an unexpected anomaly.
                                </p>
                                {error.cause ? (
                                    <div className="bg-red-950/30 border border-red-500/20 p-4 rounded-lg text-left text-xs font-mono text-red-400 overflow-auto max-h-32">
                                        {error.message}
                                    </div>
                                ) : null}
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
                                <button
                                    onClick={() => reset()}
                                    className="h-14 px-10 flex items-center justify-center text-sm font-black tracking-[0.2em] rounded-xl bg-primary text-black hover:bg-primary/90 shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_50px_rgba(var(--primary-rgb),0.5)] transition-all duration-300 group"
                                >
                                    <span className="mr-2">↻</span> REBOOT SYSTEM
                                </button>

                                <Link
                                    href="/"
                                    className="h-14 px-10 flex items-center justify-center text-sm font-black tracking-[0.2em] rounded-xl border border-white/10 text-white hover:bg-white/5 hover:border-white/20 hover:text-white transition-all duration-300 backdrop-blur-md"
                                >
                                    <MoveLeft className="mr-3 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                                    RETURN HOME
                                </Link>
                            </div>

                            <div className="pt-8">
                                <Link
                                    href="https://discord.gg/basalt"
                                    target="_blank"
                                    className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center justify-center gap-2"
                                >
                                    Need assistance? Contact support on Discord <span className="text-primary">→</span>
                                </Link>
                            </div>
                        </motion.div>
                    </div>

                    {/* Premium Decorative Blobs */}
                    <div className="fixed -bottom-48 -left-48 w-[600px] h-[600px] bg-red-500/10 rounded-full blur-[150px] pointer-events-none animate-pulse" />
                    <div className="fixed -top-48 -right-48 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[150px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
            </body>
        </html>
    );
}
