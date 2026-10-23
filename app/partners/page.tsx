import { Metadata } from "next";
import BasaltNavbar from "@/components/basaltcrm-landing/BasaltNavbar";
import BasaltFooter from "@/components/basaltcrm-landing/BasaltFooter";
import FluidNeuralWave from "@/app/components/FluidNeuralWave";
import { dbAdapter } from "@/lib/database/db-adapter";
import Link from "next/link";
import { Search, Trophy, Globe, Calendar, Briefcase, Mail } from "lucide-react";

export const metadata: Metadata = {
    title: "Certified Partners | BasaltCRM",
    description: "Find an elite Strategic Master to install and automate your CRM.",
};

export const dynamic = "force-dynamic";

export default async function PartnersDirectory() {
    let partners: any[] = [];
    
    try {
        const usersCollection = await dbAdapter.getNativeCollection("Users");
        partners = await usersCollection.find({ 
            "partner_profile.is_active": true,
            $or: [
                { university_level: { $gte: 21 } },
                { level: { $gte: 21 } }
            ]
        }).toArray();
    } catch (e) {
        console.error("Failed to load partners:", e);
    }

    return (
        <div className="dark min-h-screen bg-black text-white font-sans selection:bg-cyan-500/30 overflow-x-hidden">
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none">
                <FluidNeuralWave variant="complex" seed={2.5} />
            </div>

            <div className="relative z-10 flex flex-col min-h-screen">
                <BasaltNavbar />

                <main className="flex-grow pt-32 pb-24 px-6 relative z-10">
                    <div className="max-w-6xl mx-auto space-y-16">
                        {/* Header */}
                        <div className="text-center space-y-6 max-w-3xl mx-auto">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-black uppercase tracking-widest mx-auto">
                                <Trophy className="w-3.5 h-3.5" />
                                Elite Emissaries
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black italic tracking-tight uppercase leading-none bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                                Certified Partners
                            </h1>
                            <p className="text-gray-400 text-lg md:text-xl font-medium">
                                Hire a Strategic Master to architect, automate, and install your CRM ecosystem. These elite experts have reached Level 21+ across the Basalt ecosystem.
                            </p>
                        </div>

                        {/* Directory Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {partners.length === 0 ? (
                                <div className="col-span-full py-20 text-center border border-white/5 rounded-3xl bg-black/40 backdrop-blur-sm">
                                    <Trophy className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                    <h3 className="text-xl font-black text-white mb-2">No Partners Found</h3>
                                    <p className="text-gray-500">Be the first to reach Strategic Master and list your agency here.</p>
                                </div>
                            ) : (
                                partners.map((partner) => (
                                    <div key={partner._id.toString()} className="group relative rounded-3xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-sm hover:border-amber-500/30 transition-colors p-8">
                                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        
                                        <div className="relative z-10 space-y-6">
                                            {/* Top row */}
                                            <div className="flex items-start justify-between">
                                                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                                                    {partner.avatar ? (
                                                        <img src={partner.avatar} alt="Avatar" className="w-full h-full rounded-2xl object-cover" />
                                                    ) : (
                                                        <Briefcase className="w-8 h-8 text-amber-500" />
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] font-black tracking-widest text-gray-500 uppercase block mb-1">Level</span>
                                                    <span className="text-amber-500 font-black text-2xl leading-none block">{partner.university_level || partner.level || 21}</span>
                                                </div>
                                            </div>

                                            {/* Details */}
                                            <div>
                                                <h3 className="text-xl font-black text-white">{partner.partner_profile?.agency_name || partner.name}</h3>
                                                <p className="text-sm font-black text-amber-500/80 mb-3">{partner.partner_profile?.agency_name ? partner.name : "CRM Engineer"}</p>
                                                <p className="text-sm text-gray-400 line-clamp-3 h-16">
                                                    {partner.partner_profile?.bio || "Expert CRM architect specializing in automated lead flows, RevOps alignment, and system integrations."}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="pt-4 border-t border-white/10 flex flex-wrap gap-2">
                                                {partner.partner_profile?.website && (
                                                    <a href={partner.partner_profile.website.startsWith('http') ? partner.partner_profile.website : `https://${partner.partner_profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 transition-colors">
                                                        <Globe className="w-3 h-3" /> Website
                                                    </a>
                                                )}
                                                {partner.partner_profile?.calendar_url && (
                                                    <a href={partner.partner_profile.calendar_url.startsWith('http') ? partner.partner_profile.calendar_url : `https://${partner.partner_profile.calendar_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold text-amber-500 transition-colors">
                                                        <Calendar className="w-3 h-3" /> Book Call
                                                    </a>
                                                )}
                                                {!partner.partner_profile?.calendar_url && partner.email && (
                                                    <a href={`mailto:${partner.email}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 transition-colors">
                                                        <Mail className="w-3 h-3" /> Contact
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </main>

                <BasaltFooter />
            </div>
        </div>
    );
}
