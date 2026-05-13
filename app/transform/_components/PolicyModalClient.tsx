"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, FileText, Database, ChevronRight, Check } from "lucide-react";

const SLIDES = [
  {
    id: "terms",
    title: "Terms of Service",
    icon: FileText,
    content: (
      <div className="space-y-4 text-sm text-zinc-400">
        <p>
          Welcome to BasaltLens. By using our document processing and extraction services, you agree to our comprehensive Terms of Service.
        </p>
        <p>
          Our services are provided "as is" and are designed to facilitate AI-powered tabular extraction, OCR, and document layout analysis. You agree not to upload illicit, illegal, or copyrighted material for which you do not hold authorization.
        </p>
      </div>
    )
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    icon: Shield,
    content: (
      <div className="space-y-4 text-sm text-zinc-400">
        <p>
          Your privacy is a core priority at BasaltLens. We employ industry-standard encryption and temporary execution environments for all document processing.
        </p>
        <p>
          Documents processed through our temporary pipeline are kept in volatile memory and ephemeral storage only for the duration of the processing job, after which they are securely purged.
        </p>
      </div>
    )
  },
  {
    id: "data",
    title: "Data Policy",
    icon: Database,
    content: (
      <div className="space-y-4 text-sm text-zinc-400">
        <p>
          <strong>No data is stored on our end for Lens</strong> unless you explicitly choose to use the Vault (which is purely for secure storage).
        </p>
        <p>
          However, if you choose to import processed data directly into the CRM, only our <strong>Enterprise clients</strong> will have it stored fully privately. For all other subscriptions, the imported data may be included in our global leads pool and used for AI optimization.
        </p>
      </div>
    )
  }
];

export function PolicyModalClient() {
  const [open, setOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const hasSeen = localStorage.getItem("lens_policy_accepted");
    if (!hasSeen) {
      setOpen(true);
    }
  }, []);

  const handleNext = () => {
    if (slideIndex < SLIDES.length - 1) {
      setSlideIndex(slideIndex + 1);
    } else {
      localStorage.setItem("lens_policy_accepted", "true");
      setOpen(false);
    }
  };

  const currentSlide = SLIDES[slideIndex];
  const Icon = currentSlide.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => { if(!v && slideIndex === SLIDES.length - 1) setOpen(false); }}>
      <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 shadow-2xl p-0 gap-0 overflow-hidden rounded-2xl [&>button]:hidden">
        <div className="h-1 w-full bg-zinc-900 overflow-hidden">
          <motion.div 
            className="h-full bg-orange-500" 
            initial={{ width: `${(slideIndex / SLIDES.length) * 100}%` }}
            animate={{ width: `${((slideIndex + 1) / SLIDES.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        
        <div className="p-6 pt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={slideIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="min-h-[200px]"
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 border border-orange-500/20">
                  <Icon className="w-6 h-6 text-orange-500" />
                </div>
                <DialogTitle className="text-xl font-bold text-white mb-2">
                  {currentSlide.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {currentSlide.title} terms and information
                </DialogDescription>
              </div>
              
              {currentSlide.content}
            </motion.div>
          </AnimatePresence>
        </div>

        <DialogFooter className="p-6 bg-zinc-900/50 border-t border-zinc-800/50 flex flex-row items-center justify-between sm:justify-between">
          <div className="flex gap-1">
            {SLIDES.map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full transition-colors ${i === slideIndex ? 'bg-orange-500' : 'bg-zinc-700'}`} 
              />
            ))}
          </div>
          <Button 
            onClick={handleNext}
            className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20 px-6"
          >
            {slideIndex < SLIDES.length - 1 ? (
              <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
            ) : (
              <>I Agree <Check className="w-4 h-4 ml-1" /></>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
