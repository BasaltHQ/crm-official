"use client";
import { z } from "zod";
import axios from "axios";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";
import { Plus, Check, Shield, Zap, Target, Users as UsersIcon, HardDrive, CreditCard, ChevronRight, Sparkles, Calendar, Info, Wallet, Eye, EyeOff, User, Upload, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile } from '@marsidev/react-turnstile';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
// Unused imports removed
interface RegisterComponentProps {
  availablePlans: any[];
  initialPlanSlug?: string;
  initialCycle?: string;
}

export function RegisterComponent({ availablePlans, initialPlanSlug, initialCycle }: RegisterComponentProps) {
  const safePlans = React.useMemo(
    () =>
      (availablePlans || []).filter(
        (plan) =>
          plan?.isActive !== false &&
          ["STARTER", "GROWTH", "SCALE"].includes(String(plan?.slug || "").toUpperCase())
      ),
    [availablePlans]
  );

  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">((initialCycle as any) || "monthly");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "crypto">("card");
  const [wallet, setWallet] = useState("");

  // Legal Agreements
  const [termsRead, setTermsRead] = useState(process.env.NODE_ENV === "development" ? false : false);
  const [privacyRead, setPrivacyRead] = useState(false);
  const [dataPolicyRead, setDataPolicyRead] = useState(false);
  const [openTerms, setOpenTerms] = useState(false);
  const [openPrivacy, setOpenPrivacy] = useState(false);
  const [openDataPolicy, setOpenDataPolicy] = useState(false);

  const handleScrollToBottom = (e: React.UIEvent<HTMLDivElement>, setter: (val: boolean) => void) => {
    // Add 10px tolerance for scaling issues
    const isAtBottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 10;
    if (isAtBottom) {
      setter(true);
    }
  };

  const formSchema = z.object({
    companyName: z.string().min(2, "Company name is required").max(50),
    planId: z.string().min(1, "Please select a plan"),
    firstName: z.string().min(2, "First name is required").max(50),
    lastName: z.string().min(2, "Last name is required").max(50),
    phone: z.string().min(10, "Valid phone number required for KYC").max(20),
    username: z.string().min(3).max(50),
    email: z.string().email(),
    language: z.string().min(2).max(50),
    password: z
      .string()
      .min(15, "SOC2 Compliance: Minimum length is 15 characters.")
      .max(128), // Support long passphrases per NIST
    confirmPassword: z.string(),
    avatar: z.string().min(1, "Profile photo is required"),
    termsAccepted: z.boolean().refine((val) => val === true, {
      message: "You must accept the Terms of Service and Privacy Policy.",
    }),
    turnstile_token: z.string().optional(),
  });

  type BillboardFormValues = z.infer<typeof formSchema>;

  const form = useForm<BillboardFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "",
      planId: "",
      firstName: "",
      lastName: "",
      phone: "",
      username: "",
      email: "",
      language: "en",
      password: "",
      confirmPassword: "",
      avatar: "",
      termsAccepted: false,
      turnstile_token: "",
    },
  });

  React.useEffect(() => {
    if (initialPlanSlug) {
      const plan = safePlans.find(p => String(p.slug || "").toLowerCase() === initialPlanSlug.toLowerCase());
      if (plan) {
        form.setValue("planId", plan.id);
      }
    }
  }, [initialPlanSlug, safePlans, form]);

  const onSubmit = async (data: BillboardFormValues) => {
    if (data.password !== data.confirmPassword) {
      form.setError("confirmPassword", { message: "Passwords do not match" });
      return;
    }

    setIsLoading(true);
    try {
      const submissionData = {
        ...data,
        name: `${data.firstName} ${data.lastName}`,
        billingCycle,
        paymentMethod,
        wallet: wallet.startsWith("0x") ? wallet : undefined
      };

      const response = await axios.post("/api/user", submissionData);

      if (response.data.requiresPayment && response.data.paymentUrl) {
        setPaymentUrl(response.data.paymentUrl);
        
        toast({
          title: "Account Created (Pending Payment)",
          description: "Redirecting you to secure checkout...",
        });

        if (typeof window !== "undefined" && (window as any).lintrk) {
          (window as any).lintrk('track', { conversion_id: 24983276 });
        }

        // Redirect directly to Stripe Checkout session
        window.location.href = response.data.paymentUrl;
      } else {
        toast({
          title: "Success",
          description: "User created successfully, please login.",
        });

        if (typeof window !== "undefined" && (window as any).lintrk) {
          (window as any).lintrk('track', { conversion_id: 24983276 });
        }

        router.push("/sign-in");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.response?.data || "Something went wrong.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, "");
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  };

  const formValues = form.watch();
  const passwordStatus = {
    length: (formValues.password?.length || 0) >= 15,
    match: formValues.password && formValues.confirmPassword && formValues.password === formValues.confirmPassword,
  };

  const requiredSteps = [
    { id: 'avatar', label: 'Profile Photo', isComplete: !!formValues.avatar },
    { id: 'company', label: 'Company Name', isComplete: !!formValues.companyName && formValues.companyName.length >= 2 },
    { id: 'plan', label: 'Select Tier', isComplete: !!formValues.planId },
    { id: 'personal', label: 'Personal Info', isComplete: !!formValues.firstName && !!formValues.lastName && !!formValues.phone && !!formValues.username && !!formValues.email },
    { id: 'password', label: 'Secure Password', isComplete: passwordStatus.length && passwordStatus.match },
    { id: 'terms', label: 'Legal Agreements', isComplete: !!formValues.termsAccepted },
  ];
  const allStepsComplete = requiredSteps.every(s => s.isComplete);


  return (
    <Card className="shadow-lg my-5 w-full max-w-lg sm:max-w-xl mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">Create Account</CardTitle>
        <CardDescription>Enter your information to create an account.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 overflow-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} suppressHydrationWarning={true}>
            {/* Avatar Section */}
            <div className="flex flex-col items-center justify-center space-y-4 py-4">
              <FormField
                control={form.control}
                name="avatar"
                render={({ field }) => (
                  <FormItem className="flex flex-col items-center">
                    <FormLabel className="mb-2">Profile Photo <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <div className="flex flex-col items-center space-y-4">
                        <div
                          className="relative h-28 w-28 rounded-full overflow-hidden border-2 border-dashed border-primary/30 flex items-center justify-center bg-muted/20 group hover:border-primary/60 transition-[color,background-color,border-color,box-shadow] cursor-pointer shadow-sm hover:shadow-md"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {field.value ? (
                            <>
                              <img src={field.value} alt="Avatar Preview" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <Upload className="h-6 w-6 text-white" />
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center">
                              <User className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                              <span className="text-[10px] text-muted-foreground mt-1 uppercase font-medium">Upload</span>
                            </div>
                          )}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => field.onChange(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }} />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 px-4 rounded-full"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-3.5 w-3.5 mr-2" />
                          {field.value ? "Change Avatar" : "Choose Profile Photo"}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Form Fields */}
            <div className="grid gap-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Official Entity / Team Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input disabled={isLoading} autoComplete="organization" placeholder="e.g. Acme Corporation LLC" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col space-y-6">
                {/* Billing Cycle Toggle */}
                <div className="flex flex-col space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Billing Strategic Cycle</Label>
                  <div className="flex bg-zinc-900/50 p-1.5 rounded-xl border border-white/5 relative">
                    <button
                      type="button"
                      onClick={() => { setBillingCycle("monthly"); setPaymentMethod("card"); }}
                      className={cn(
                        "flex-1 py-2.5 text-xs font-bold rounded-lg transition-colors",
                        billingCycle === "monthly" ? "bg-zinc-800 text-white shadow-lg border border-white/10" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle("annual")}
                      className={cn(
                        "flex-1 py-2.5 text-xs font-bold rounded-lg transition-colors relative overflow-hidden",
                        billingCycle === "annual" ? "bg-zinc-800 text-white shadow-lg border border-white/10" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      Annual Account
                      <span className={cn("ml-2 text-[9px] px-1.5 py-0.5 rounded-full",
                        (paymentMethod === 'crypto' && wallet.length === 42) ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/20 text-primary")}>
                        {(paymentMethod === 'crypto' && wallet.length === 42) ? '-25%' : '-20%'}
                      </span>
                    </button>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="planId"
                  render={({ field }) => {
                    const selectedPlan = safePlans.find(p => p.id === field.value);
                    const isFree = String(selectedPlan?.slug || "").toUpperCase() === "STARTER";
                    return (
                      <FormItem>
                        <FormLabel>Selected Tier <span className="text-red-500">*</span></FormLabel>
                        <Select disabled={isLoading} onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 bg-zinc-900/50 border-white/10 hover:border-primary/50 transition-colors font-bold italic">
                              <SelectValue placeholder="Identify your strategy" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-zinc-950 border-zinc-800">
                            {safePlans
                              .map((plan) => {
                                const isFreePlan = String(plan.slug || "").toUpperCase() === "STARTER";
                                return (
                                <SelectItem 
                                  key={plan.id} 
                                  value={plan.id}
                                >
                                  <div className="flex flex-col py-1">
                                    <span className="font-bold">{plan.name}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest text-primary/80">
                                      {plan.price === 0 
                                        ? "FREE FOREVER" 
                                        : billingCycle === "monthly"
                                          ? `${plan.currency || "$"} ${plan.price} / MONTH`
                                          : `${plan.currency || "$"} ${Math.round((paymentMethod === 'crypto' && wallet.length === 42) ? (plan.price * 12 * 0.75) : (plan.price * 12 * 0.8))} / YEAR`}
                                    </span>
                                  </div>
                                </SelectItem>
                              )})}
                          </SelectContent>
                        </Select>

                        {selectedPlan && (
                          <div className="mt-4 p-5 rounded-2xl border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden">
                            <div className="absolute -right-4 -bottom-4 opacity-5">
                              <Shield className="w-24 h-24 rotate-12" />
                            </div>
                            <div className="relative z-10">
                              <div className="flex items-center gap-2 mb-3">
                                <Zap className="w-4 h-4 text-primary animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">System Module DNA (RBAC)</span>
                              </div>
                              <ul className="grid grid-cols-2 gap-2">
                                {selectedPlan.features.includes("all") ? (
                                  <li className="col-span-2 text-[11px] text-white font-bold flex items-center gap-2">
                                    <Check className="w-3 h-3 text-primary" />
                                    FULL ECOSYSTEM (29+ MODULES)
                                  </li>
                                ) : (
                                  selectedPlan.features.map((f: string) => (
                                    <li key={f} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                      <div className="w-1 h-1 rounded-full bg-primary/40" />
                                      {f.charAt(0).toUpperCase() + f.slice(1).replace(/_/g, ' ')}
                                    </li>
                                  )).slice(0, 8)
                                )}
                              </ul>
                              <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Initial Settlement</span>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black italic">
                                      ${billingCycle === "monthly"
                                        ? selectedPlan.price
                                        : Math.round((paymentMethod === 'crypto' && wallet.length === 42) ? (selectedPlan.price * 12 * 0.75) : (selectedPlan.price * 12 * 0.8))}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase">{billingCycle === "annual" ? "/ Year" : "/ Mo"}</span>
                                  </div>
                                </div>
                                {billingCycle === "annual" && (
                                  <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/5 font-black italic">
                                    {(paymentMethod === 'crypto' && wallet.length === 42) ? "25% P2P DISCOUNT" : "20% ANNUAL DISCOUNT"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {!isFree && selectedPlan && (
                          <div className="mt-6">
                            <Label className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-2 block ml-1">P2P Discount Activator</Label>
                            <div className="relative group">
                              <div className={cn("absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-primary rounded-xl blur opacity-10 transition duration-500", wallet.length === 42 ? "opacity-40" : "group-hover:opacity-20")}></div>
                              <div className="relative">
                                <Wallet className={cn("absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors", wallet.length === 42 ? "text-emerald-400" : "text-zinc-600")} />
                                <Input
                                  placeholder="Paste Wallet (0x...) for 25% Off"
                                  value={wallet}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setWallet(val);
                                    if (val.length === 42 && val.startsWith("0x")) {
                                      setPaymentMethod("crypto");
                                      setBillingCycle("annual");
                                    } else if (val.length === 0) {
                                      setPaymentMethod("card");
                                    }
                                  }}
                                  className={cn("bg-zinc-900/50 border-white/10 h-12 text-xs font-mono pl-11", wallet.length === 42 ? "border-emerald-500/50 text-emerald-400" : "")}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Legal First Name <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input disabled={isLoading} autoComplete="given-name" placeholder="e.g. John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Legal Last Name <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input disabled={isLoading} autoComplete="family-name" placeholder="e.g. Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Contact Number <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input 
                            disabled={isLoading} 
                            autoComplete="tel" 
                            placeholder="(555) 000-0000" 
                            {...field} 
                            onChange={(e) => {
                              const formatted = formatPhoneNumber(e.target.value);
                              field.onChange(formatted);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input disabled={isLoading} autoComplete="username" placeholder="e.g. jdoe_global" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work E-mail <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" inputMode="email" disabled={isLoading} placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />


                <div className="flex flex-col gap-4">
                  <div className="relative">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input disabled={isLoading} autoComplete="new-password" placeholder="Min 15 characters required (SOC2)" type={show ? "text" : "password"} {...field} className="pr-10" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <button type="button" aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-10 text-gray-400 hover:text-primary transition-colors" onClick={() => setShow(!show)}>
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <div className="relative">
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input disabled={isLoading} autoComplete="new-password" placeholder="Re-enter your 15+ character password" type={show ? "text" : "password"} {...field} className="pr-10" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <button type="button" aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-10 text-gray-400 hover:text-primary transition-colors" onClick={() => setShow(!show)}>
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <div className="bg-zinc-900/40 rounded-xl p-4 border border-white/5 space-y-3 mt-2">
                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-500 mb-1">
                      <Shield className="w-3.5 h-3.5 text-indigo-400" />
                      SOC2 Password Criteria
                    </div>
                    <div className={cn("text-xs font-medium flex items-center gap-2 transition-colors", passwordStatus.length ? "text-emerald-400" : "text-zinc-500")}>
                      {passwordStatus.length ? <Check className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-zinc-600 border-dashed shrink-0" />}
                      Minimum 15 characters required
                    </div>
                    <div className={cn("text-xs font-medium flex items-center gap-2 transition-colors", passwordStatus.match ? "text-emerald-400" : "text-zinc-500")}>
                      {passwordStatus.match ? <Check className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-zinc-600 border-dashed shrink-0" />}
                      Passwords must match
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="termsAccepted"
                  render={({ field }) => {
                    const allRead = termsRead && privacyRead && dataPolicyRead;

                    return (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-white/10 bg-zinc-900/50 p-4 relative mb-2">
                      <div className="flex items-start space-x-3 w-full">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isLoading || !allRead}
                            className={cn("mt-0.5", !allRead && "opacity-50 cursor-not-allowed")}
                          />
                        </FormControl>
                        <div className="space-y-2 w-full">
                          <label className="text-xs font-medium leading-relaxed text-zinc-300 block">
                            I accept the 
                            <button type="button" onClick={() => setOpenTerms(true)} className={cn("mx-1 hover:underline italic font-bold", termsRead ? "text-emerald-400" : "text-primary")}>Terms of Service {termsRead && "✓"}</button>, 
                            <button type="button" onClick={() => setOpenPrivacy(true)} className={cn("mx-1 hover:underline italic font-bold", privacyRead ? "text-emerald-400" : "text-primary")}>Privacy Policy {privacyRead && "✓"}</button>, and 
                            <button type="button" onClick={() => setOpenDataPolicy(true)} className={cn("mx-1 hover:underline italic font-bold", dataPolicyRead ? "text-emerald-400" : "text-primary")}>AI Data Processing Agreement {dataPolicyRead && "✓"}</button>
                          </label>
                          <FormDescription className="text-[10px] text-zinc-500 max-w-[90%] block">
                            By enabling this, you agree to our terms, privacy policies, and crucial rules for AI processing on your CRM data.
                            <br/>
                            <span className={cn("font-bold mt-1 inline-block text-[10px]", allRead ? "text-emerald-500/80" : "text-amber-500/80")}>
                                {allRead ? "All documents reviewed. You may proceed." : "⚠️ You must read and scroll to the bottom of all 3 documents before accepting."}
                            </span>
                          </FormDescription>
                        </div>
                      </div>
                    </FormItem>
                  )}}
                />

                {/* Terms of Service Modal */}
                <Dialog open={openTerms} onOpenChange={setOpenTerms}>
                   <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-800 h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl shadow-primary/10">
                      <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0">
                          <DialogTitle className="text-2xl font-black italic tracking-tighter text-white uppercase">Enterprise Terms of Service</DialogTitle>
                          <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest", termsRead ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-500 border border-amber-500/20")}>
                            {termsRead ? "Acknowledged" : "Scroll to Review"}
                          </span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-8 text-sm text-zinc-400 space-y-8 scrollbar-thin scrollbar-thumb-zinc-800" onScroll={(e) => handleScrollToBottom(e, setTermsRead)}>
                         <section>
                            <p className="text-zinc-200 leading-relaxed font-bold uppercase tracking-wide">
                                Master Terms of Service Agreement
                            </p>
                            <p className="text-zinc-400 mt-2">
                                Effective Date: April 1, 2026.
                            </p>
                            <p className="mt-4">
                                This Master Terms of Service Agreement ("Agreement" or "Terms") constitutes a legally binding contract between you (referred to herein as "Customer", "Subscriber", "Licensee", or "Authorized User") and BasaltHQ Inc., a corporation organized and existing under the laws of the State of Delaware (referred to herein as "Company", "we", "us", "our", or "Licensor"). This Agreement meticulously governs your access to, integration with, and utilization of the BasaltCRM enterprise platform, interconnected artificial intelligence networks, proprietary data scraping utilities, and all associated communication infrastructure architectures (collectively, the "Service").
                            </p>
                            <p className="mt-4">
                                BY EXECUTING AN ORDER FORM THAT REFERENCES THIS AGREEMENT, BY DEPRESSING THE "I AGREE", "AUTHORIZE", OR "ACCEPT" BUTTON ASSOCIATED WITH THIS AGREEMENT, OR BY ACCESSING OR CONTINUING TO UTILIZE THE SERVICE IN ANY CAPACITY, YOU EXPRESSLY SIGNIFY YOUR UNEQUIVOCAL, UNCONDITIONAL, AND ABSOLUTE CONSENT TO BE BOUND BY THESE TERMS. IF YOU ARE ENTERING INTO THIS AGREEMENT ON BEHALF OF A CORPORATE ENTITY, LIMITED LIABILITY COMPANY, PARTNERSHIP, OR OTHER LEGAL ORGANIZATION, YOU HEREBY REPRESENT, WARRANT, AND COVENANT THAT YOU POSSESS THE REQUISITE LEGAL AUTHORITY TO BIND SUCH ENTITY AND ITS AFFILIATES TO THESE TERMS. IF YOU LACK SUCH AUTHORITY, OR IF YOU DO NOT WHOLLY AGREE WITH EVERY PROVISION SET FORTH HEREIN, YOU MUST NOT ACCEPT THIS AGREEMENT AND MAY NOT ACCESS OR USE THE SERVICE.
                            </p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">1. Definitions</h3>
                            <p><strong>1.1. "Affiliate"</strong> means any entity that directly or indirectly controls, is controlled by, or is under common control with the subject entity.</p>
                            <p><strong>1.2. "Authorized User"</strong> means an individual who is explicitly authorized by the Customer to use a Service, for whom Customer has purchased a subscription (or in the case of any Services provided by Us without charge, for whom a Service has been provisioned), and to whom Customer (or, when applicable, Us at Customer's request) has supplied a user identification and password.</p>
                            <p><strong>1.3. "Customer Data"</strong> means electronic data and information submitted by or for Customer to the Services, excluding content from third-party applications.</p>
                            <p><strong>1.4. "Malicious Code"</strong> means code, files, scripts, agents, or programs intended to do harm, including, for example, viruses, worms, time bombs, and Trojan horses.</p>
                            <p><strong>1.5. "Order Form"</strong> means an ordering document or online order specifying the Services to be provided hereunder that is entered into between Customer and Us.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">2. Grant of License and Scope of Use</h3>
                            <p><strong>2.1. Provision of Services.</strong> We will (a) make the Services and Content available to Customer pursuant to this Agreement, and the applicable Order Forms and Documentation, (b) provide applicable standard support for the Services to Customer at no additional charge, and (c) use commercially reasonable efforts to make the online Services available 24 hours a day, 7 days a week, except for: (i) planned downtime (of which We shall give advance electronic notice), and (ii) any unavailability caused by circumstances beyond Our reasonable control.</p>
                            <p><strong>2.2. Non-Exclusive License.</strong> Subject to Customer's strict adherence to this Agreement and timely remittance of all due pecuniary obligations, BasaltHQ grants Customer a localized, non-exclusive, non-transferable, non-sublicensable, and completely revocable right to access and leverage the Service strictly for Customer's internal business operations.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">3. Restrictions on Use</h3>
                            <p><strong>3.1. Prohibited Actions.</strong> Customer shall not entirely, nor permit any third party under its direction or control to: (a) permit any third party to access the Services except as permitted herein; (b) create derivate works based on the Services; (c) copy, frame, or mirror any part or content of the Services; (d) reverse engineer, decompile, disassemble, or otherwise attempt to discover the source code, object code, or underlying structure, ideas, or algorithms of the Services; (e) access the Services in order to build a competitive product or service; or (f) utilize the Services to traffic maliciously, including but not limited to the distribution of malware, facilitation of phishing operations, or unregulated predatory data harvesting.</p>
                            <p><strong>3.2. Rate Limiting.</strong> Interfacing with our API endpoints is subject to hard programmatic rate limits designed to insulate the architectural integrity of our shared ecosystem. Customers engaging in "DDoS-style" requests or circumventing standard pagination limits will face immediate API key nullification without preliminary warning.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">4. Customer Responsibilities</h3>
                            <p><strong>4.1. Account Sovereignty.</strong> Customer is solely accountable for the fidelity, quality, legality, and operational implications of Customer Data, the means by which Customer acquired Customer Data, and Customer's utilization of Customer Data with the Services. Customer will apply commercially reasonable methodologies to thwart unauthorized access to or use of Services and Content.</p>
                            <p><strong>4.2. Regulatory Strictures.</strong> The Customer assumes an absolute, non-delegable duty to ensure all communication dispatches (e.g., SMTP polling, SMS routing, Voice synthesis) initiated via BasaltCRM adhere strictly to prevailing multi-jurisdictional frameworks, encompassing, but not relegated to, the Telephone Consumer Protection Act (TCPA), the CAN-SPAM Act, the Telemarketing Sales Rule (TSR), and the General Data Protection Regulation (GDPR).</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">5. Fees and Payment for Purchased Services</h3>
                            <p><strong>5.1. Fees.</strong> Customer will pay all fees specified in Order Forms. Except as otherwise specified herein or in an Order Form, (i) fees are based on Services and Content subscriptions purchased and not actual usage, (ii) payment obligations are non-cancelable and fees paid are non-refundable, and (iii) quantities purchased cannot be decreased during the relevant subscription term.</p>
                            <p><strong>5.2. Invoicing and Payment.</strong> Customer will provide Us with valid and updated credit card information, or with a valid purchase order or alternative document reasonably acceptable to Us. If Customer provides credit card information, Customer authorizes Us to charge such credit card for all Purchased Services. Charges shall be made in advance, either annually or in accordance with any different billing frequency stated.</p>
                            <p><strong>5.3. Overdue Charges & Chargebacks.</strong> If any invoiced amount is not received by Us by the due date, then without limiting Our rights or remedies, those charges may accrue late interest at the rate of 1.5% of the outstanding balance per month, or the maximum rate permitted by law, whichever is lower. The initiation of an uncoordinated bank chargeback against properly rendered services will constitute an immediate, material breach resulting in terminal systemic suspension.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">6. Proprietary Rights and Licenses</h3>
                            <p><strong>6.1. Reservation of Rights.</strong> Subject to the limited rights expressly granted hereunder, We reserve all of Our right, title and interest in and to the Services and Content, including all of Our related intellectual property rights. No rights are granted to Customer hereunder other than as expressly set forth herein.</p>
                            <p><strong>6.2. License by Customer.</strong> Customer grants Us, Our Affiliates, and applicable contractors a worldwide, limited-term license to host, copy, transmit and display Customer Data as necessary for Us to provide the Services in accordance with this Agreement. Subject to the limited licenses granted herein, We acquire no right, title or interest from Customer under this Agreement in or to any Customer Data.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">7. Confidentiality</h3>
                            <p><strong>7.1. Definition of Confidential Information.</strong> "Confidential Information" means all information disclosed by a party ("Disclosing Party") to the other party ("Receiving Party"), whether orally or in writing, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure.</p>
                            <p><strong>7.2. Protection of Confidential Information.</strong> The Receiving Party will use the same degree of care that it uses to protect the confidentiality of its own confidential information of like kind (but not less than reasonable care) to (i) not use any Confidential Information of the Disclosing Party for any purpose outside the scope of this Agreement and (ii) except as otherwise authorized by the Disclosing Party in writing, limit access to Confidential Information.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">8. Representations, Warranties, Exclusive Remedies and Disclaimers</h3>
                            <p><strong>8.1. Mutual Representations.</strong> Each party represents that it has validly entered into this Agreement and has the legal power to do so.</p>
                            <p><strong>8.2. Disclaimers.</strong> EXCEPT AS EXPRESSLY PROVIDED HEREIN, NEITHER PARTY MAKES ANY WARRANTY OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY OR OTHERWISE, AND EACH PARTY SPECIFICALLY DISCLAIMS ALL IMPLIED WARRANTIES, INCLUDING ANY IMPLIED WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE OR NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW. CONTENT AND BETA SERVICES ARE PROVIDED "AS IS," EXCLUSIVE OF ANY WARRANTY WHATSOEVER.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">9. Mutual Indemnification</h3>
                            <p><strong>9.1. Indemnification by Us.</strong> We will defend Customer against any claim, demand, suit or proceeding made or brought against Customer by a third party alleging that any Service infringes or misappropriates such third party's intellectual property rights, and will indemnify Customer from any damages, attorney fees and costs finally awarded against Customer.</p>
                            <p><strong>9.2. Indemnification by Customer.</strong> Customer will defend Us against any claim, demand, suit or proceeding made or brought against Us by a third party alleging that any Customer Data or Customer's use of Customer Data with the Services, or Customer's use of the Services in breach of this Agreement, infringes or misappropriates such third party's intellectual property rights or violates applicable law (including but not limited to TCPA, CAN-SPAM, GDPR).</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">10. Limitation of Liability</h3>
                            <p><strong>10.1. Limitation of Liability.</strong> IN NO EVENT SHALL THE MAXIMUM AGGREGATE LIABILITY OF EITHER PARTY TOGETHER WITH ALL OF ITS AFFILIATES ARISING OUT OF OR RELATED TO THIS AGREEMENT EXCEED THE TOTAL AMOUNT PAID BY CUSTOMER AND ITS AFFILIATES HEREUNDER FOR THE SERVICES GIVING RISE TO THE LIABILITY IN THE TWELVE MONTHS PRECEDING THE FIRST INCIDENT OUT OF WHICH THE LIABILITY AROSE.</p>
                            <p><strong>10.2. Exclusion of Consequential Damages.</strong> IN NO EVENT WILL EITHER PARTY OR ITS AFFILIATES HAVE ANY LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT FOR ANY LOST PROFITS, REVENUES, GOODWILL, OR INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL, COVER, BUSINESS INTERRUPTION OR PUNITIVE DAMAGES, WHETHER AN ACTION IS IN CONTRACT OR TORT.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">11. Term and Termination</h3>
                            <p><strong>11.1. Term of Agreement.</strong> This Agreement commences on the date Customer first accepts it and continues until all subscriptions hereunder have expired or have been terminated.</p>
                            <p><strong>11.2. Termination.</strong> A party may terminate this Agreement for cause (i) upon 30 days written notice to the other party of a material breach if such breach remains uncured at the expiration of such period, or (ii) if the other party becomes the subject of a petition in bankruptcy or any other proceeding relating to insolvency.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">12. General Provisions</h3>
                            <p><strong>12.1. Export Compliance.</strong> The Services, Content, other technology We make available, and derivatives thereof may be subject to export laws and regulations of the United States and other jurisdictions. Each party represents that it is not named on any U.S. government denied-party list.</p>
                            <p><strong>12.2. Entire Agreement and Order of Precedence.</strong> This Agreement is the entire agreement between Customer and Us regarding Customer's use of Services and Content and supersedes all prior and contemporaneous agreements, proposals or representations, written or oral, concerning its subject matter.</p>
                            <p><strong>12.3. Governing Law and Jurisdiction.</strong> This Agreement, and any disputes arising out of or related hereto, shall be governed exclusively by the internal laws of the State of Delaware, without regard to its conflicts of laws rules or the United Nations Convention on the International Sale of Goods.</p>
                         </section>

                         <div className="pt-12 pb-8 flex flex-col items-center gap-4">
                            <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
                            {termsRead ? (
                               <Button 
                                  onClick={() => setOpenTerms(false)} 
                                  className="text-[11px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 h-auto rounded-full transition-all duration-300 transform hover:scale-105"
                               >
                                  Execution Authorized ✓
                               </Button>
                            ) : (
                               <span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                                  Scroll to bottom to electronically sign
                               </span>
                            )}
                         </div>
                      </div>
                   </DialogContent>
                </Dialog>

                {/* Privacy Policy Modal */}
                <Dialog open={openPrivacy} onOpenChange={setOpenPrivacy}>
                   <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-800 h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl shadow-primary/10">
                      <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0">
                          <DialogTitle className="text-2xl font-black italic tracking-tighter text-white uppercase">Global Privacy Policy</DialogTitle>
                          <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest", privacyRead ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-500 border border-amber-500/20")}>
                            {privacyRead ? "Acknowledged" : "Scroll to Review"}
                          </span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-8 text-sm text-zinc-400 space-y-8 scrollbar-thin scrollbar-thumb-zinc-800" onScroll={(e) => handleScrollToBottom(e, setPrivacyRead)}>
                         <section>
                            <p className="text-zinc-200 leading-relaxed font-bold uppercase tracking-wide">
                                Master Privacy Policy
                            </p>
                            <p className="text-zinc-400 mt-2">
                                Effective Date: April 1, 2026.
                            </p>
                            <p className="mt-4">
                                BasaltHQ Inc. (referred to herein as "Company", "we", "our", or "us") respects your privacy and is committed to protecting it through our strict compliance with this Master Privacy Policy ("Policy"). This Policy exhaustively describes the types of information we may collect from you or that you may provide when you visit our website, application, or leverage the BasaltCRM suite and its interconnected autonomous systems (our "Service"), and our exacting practices for collecting, using, maintaining, protecting, and disclosing that information.
                            </p>
                            <p className="mt-4">
                                This Policy applies to information we collect upon the Service; in electronic communications between you and the Service; through mobile and desktop applications you download from the Service; and dynamically via interactions with our deployed agents. Please read this policy carefully to understand our policies and practices regarding your information. If you do not agree with our policies and practices, your sole recourse is not to use our Service. By accessing or using this Service, you agree to this Policy unconditionally.
                            </p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">1. Scope of Privacy Applicability</h3>
                            <p>This Policy applies exclusively to the BasaltCRM ecosystem. It does not govern data collection by any application, website, or third-party service outside our direct infrastructure, nor does it govern information collected offline or via channels outside the defined digital perimeter of the Service. We bear no liability for the data practices of non-integrated third parties.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">2. Definitions of Processed Information</h3>
                            <p><strong>2.1. "Personal Information"</strong> means information that identifies, relates to, describes, references, is reasonably capable of being associated with, or could reasonably be linked, directly or indirectly, with a particular consumer, household, or device. This includes identifiers like a real name, alias, postal address, unique personal identifier, online identifier, Internet Protocol address, email address, account name, Social Security number, driver's license number, or other similar identifiers.</p>
                            <p><strong>2.2. "Non-Personal Information"</strong> means data that is de-identified, anonymized, or aggregated such that it cannot be reasonably linked to a specific individual or household.</p>
                            <p><strong>2.3. "Customer Metadata"</strong> means data generated by the use of our infrastructure, such as volume of messages sent, delivery rates, open rates, and general utilization heuristics of our AI engines.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">3. Modalities of Information Collection</h3>
                            <p><strong>3.1. Direct Submission.</strong> We explicitly collect Information by which you may be personally identified, such as name, postal address, e-mail address, and telephone number when you voluntarily provide corresponding entries through our webforms, account creation gateways, or direct inquiries to our corporate contact vectors.</p>
                            <p><strong>3.2. Automated Telemetry.</strong> As you navigate through and interact with our Service, we employ automatic data collection technologies to continuously harvest highly granular environmental metadata. This includes hardware specifics, operating system signatures, cryptographic browser headers, traffic patterns, and comprehensive behavioral navigation mappings (further analyzed in Section 5 via our Microsoft Clarity integration).</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">4. Purposes and Legitimate Interests of Processing</h3>
                            <p>We process the Information that we collect about you or that you proactively provide to us, including any Personal Information, to fundamentally present our Service and its contents to you; to provide you with granular utilization notices; to fulfill any other purpose for which you provide it; to carry out our obligations and legally enforce our rights arising from any contracts entered into between you and us, expressly including billing and complex revenue collection mechanisms; and to notify you unequivocally about vital systemic architectural shifts or newly available integrations.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">5. Microsoft Clarity Integration & Behavioral Telemetry</h3>
                            <p>To ensure unparalleled engineering stability and rapidly diagnose platform bottlenecks via macroscopic mapping, we inject diagnostic telemetry capture tooling globally across the dashboard. We partner explicitly with Microsoft Clarity and Microsoft Advertising to capture how Authorized Users leverage and interact with our application ecology through behavioral tracking metrics, real-time thermal heatmaps, and deterministic session replication methodologies. This ensures we can rapidly trace user-experience falloff and perfect our products. Website usage data is acquired utilizing dynamic first-party and third-party tracking algorithms to analyze geographic product viability and continuous online interactions. Furthermore, we leverage this information for platform optimization infrastructures, threat-hunting security arrays, and targeted corporate outreach. For comprehensive definitions outlining how Microsoft Corporation collects, synthesizes, and deploys your operational data, please rigorously review the official Microsoft Privacy Statement.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">6. Cookies, Local State, and Persistent Storage Mechanisms</h3>
                            <p>Our platform relies extensively on both Session (volatile) and Persistent memory cookies. Essential Cookies are non-negotiable and strictly necessary for zero-trust authentication matrices and core navigational state retention. Analytics Cookies assess continuous application fidelity and map user traversal friction. While standard browser manipulations allow you to refuse tracking cookies, invoking such protocols will result in immediate, severe degradation of our capacity to provide rapid engineering support for UI anomalies, and certain modules may reject connection attempts entirely due to missing state verification.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">7. Disclosures and Sharing (Sub-processors)</h3>
                            <p>We absolutely prohibit the sale, exchange, or unauthorized licensing of your Personal Identifiable Information (PII) to raw data brokers for marketing speculation. However, we may unequivocally disclose aggregated information about our users, and information that does not identify any individual, without restriction. We may disclose Personal Information that we collect or you provide as described in this policy: (a) To our subsidiaries and affiliates; (b) To highly vetted enterprise contractors, service providers (such as AWS, Twilio, OpenAI, Stripe), and other third parties we use strictly to support our business functions; (c) To comply with any court order, valid law enforcement subpoena, or rigorous legal process, including responding to any government or regulatory request.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">8. Intercontinental Data Transfers and SCCs</h3>
                            <p>BasaltHQ leverages geo-distributed enterprise cloud fabrics. Information collected from you may be transferred to, stored, or processed in the United States or any other country in which we, our affiliates, or our designated sub-processors maintain resilient architecture. If operational data is transferred beyond the European Economic Area (EEA), we mandate the execution of binding Standard Contractual Clauses (SCCs) to guarantee equivalent regulatory safeguards and structural privacy continuity.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">9. Data Security and Cryptographic Standards</h3>
                            <p>All client payload and persistent data is fortified beneath absolute cryptographic enforcement: Advanced Encryption Standard (AES-256) algorithms govern data at rest within physically secured enterprise cloud facilities, while Transport Layer Security (TLS 1.3 or highest available commercial grade) encrypts all volatile traffic in transit. BasaltCRM enforces ruthless internal principle-of-least-privilege mechanisms, physically isolating engineering arrays from production customer datasets. However, we cannot guarantee the absolute systemic impenetrability of the internet; any transmission of Personal Information is therefore conducted strictly at your own operational risk.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">10. Right to Erasure and Data Retention</h3>
                            <p>In adherence with the Right to be Forgotten (GDPR Article 17) and equivalent regulatory statutes, Enterprise tenants may invoke terminal hard-deletion commands upon contract dissolution. Invocation of this right systematically incinerates assigned cloud partitions and cryptographically overwrites associated vector search indices beyond the point of standard forensic recovery. Absent such invocation, we retain account routing data perpetually to maintain referential integrity of cross-tenant suppression lists and systemic security logs.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">11. State Privacy Rights (CCPA & CPRA)</h3>
                            <p>If you are a resident of California or a similarly legislatively protected state, you are endowed with specific rights regarding access to your personal information. You have the right to request comprehensive disclosure of our collection and data disbursement procedures encompassing the prior 12-month trailing operational period. You possess the strict right to formally demand that we do not "sell" or "share" your personal information, a directive we fundamentally fulfill by virtue of our strictly B2B operating philosophy.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">12. European Union Data Protection Disclosures (GDPR)</h3>
                            <p>For data subjects located within the European Economic Area, we operate strictly as a Data Processor regarding Customer CRM uploads, and a Data Controller concerning standard Account Administration Data. You possess the absolute right to lodge formal grievances with your localized Supervisory Authority should you determine our data practices deviate materially from the stringent processing limitations codified within the General Data Protection Regulation.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">13. Children's Online Privacy Protection Act (COPPA)</h3>
                            <p>Our Website and concomitant Services are explicitly constructed as elite enterprise toolsets built strictly for verified corporate operators. We do not intentionally orchestrate the extraction of data from entities under the age of eighteen (18). If we obtain validated confirmation that we have inadvertently collected Personal Information from a minor, we will execute immediate terminal deletion via our engineering protocols.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">14. Material Modifications to This Policy</h3>
                            <p>We perpetually reserve the unilateral right to amend, augment, or synthetically rewrite this Master Privacy Policy dynamically as global regulatory algorithms shift. Material systemic modifications addressing the handling of Personal Information will be boldly communicated via mandatory administrative dashboard alerts at least 30 days prior to global enforcement mapping.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-primary pl-3">15. Contact Data Compliance Officer</h3>
                            <p>To exercise any regulatory rights (Data Portability, Right to Erasure, DPO queries), or to demand formal clarification regarding the esoteric intricacies of our processing pipelines, please contact our Data Compliance team at via electronic routing to legal@basalthq.com.</p>
                         </section>

                         <div className="pt-12 pb-8 flex flex-col items-center gap-4">
                            <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
                            {privacyRead ? (
                               <Button 
                                  onClick={() => setOpenPrivacy(false)} 
                                  className="text-[11px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 h-auto rounded-full transition-all duration-300 transform hover:scale-105"
                               >
                                  Execution Authorized ✓
                               </Button>
                            ) : (
                               <span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                                  Scroll to bottom to electronically sign
                               </span>
                            )}
                         </div>
                      </div>
                   </DialogContent>
                </Dialog>

                {/* AI Data Processing Policy Modal */}
                <Dialog open={openDataPolicy} onOpenChange={setOpenDataPolicy}>
                   <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-800 h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl shadow-primary/10">
                      <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0">
                          <DialogTitle className="text-2xl font-black italic tracking-tighter text-white uppercase">Artificial Intelligence DPA</DialogTitle>
                          <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest", dataPolicyRead ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-500 border border-amber-500/20")}>
                            {dataPolicyRead ? "Acknowledged" : "Scroll to Review"}
                          </span>
                      </div>
                      <div className="flex-1 overflow-y-auto p-8 text-sm text-zinc-400 space-y-8 scrollbar-thin scrollbar-thumb-zinc-800" onScroll={(e) => handleScrollToBottom(e, setDataPolicyRead)}>
                         <section>
                            <p className="text-zinc-200 leading-relaxed font-black uppercase text-amber-500 border border-amber-500/20 bg-amber-500/5 p-4 rounded-lg">
                                CRITICAL DPA ADDENDUM: This Artificial Intelligence Data Processing Agreement ("AIDPA" or "Addendum") exhaustively governs the interaction between Customer corporate data and all underlying agentic networks, Large Language Models (LLMs), neural synthesis layers, and autonomous lead enrichment chains deployed within BasaltCRM. Due to the rapid evolution of global AI compliance algorithms, this agreement reflects cutting-edge strictures aligned with the EU AI Act classification framework. You must verify and accept these esoteric processing conditions to activate the Intelligence Engine.
                            </p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">1. Lexicon of Terminologies</h3>
                            <p><strong>1.1. "Generative Model"</strong> means any stochastic algorithmic transformer architecture utilized by the platform to generate novel textual, analytical, or programmatic inference based on user-supplied variables.</p>
                            <p><strong>1.2. "Synthetic Outputs"</strong> means the explicit data array, communication matrix, or calculated heuristic score yielded by the Generative Model following a successful prompt invocation.</p>
                            <p><strong>1.3. "RAG Infrastructure"</strong> means the Retrieval-Augmented Generation context window mechanism driving our agentic architecture.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">2. Isolated Context Windows and Multitenant Cryptography</h3>
                            <p>Any private enterprise data exposed to our vector generation systems is strictly siloed mathematically within the Customer's isolated tenant boundaries via definitive partitioning hashes. Generative LLM queries performed by Authorized Users reference ONLY their designated databases. We cryptographically guarantee that corporate context cascades do not traverse multi-tenant boundaries under any systemic permutation. Your proprietary data streams cannot leak into a competitor's generative environment.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">3. Ephemeral Telemetry Processing and API Zero-Retention</h3>
                            <p>Intelligence tasks forwarded to generalized Base Foundation Models including, but not limited to, OpenAI ecosystem models, Anthropic Claude architectures, and localized Llama variants, are processed ephemerally beneath elite Enterprise API agreements. BasaltHQ maintains zero-data-retention pacts with these primary foundation providers. Your structured CRM text, confidential notes, and historic negotiation records are irrevocably excluded from their global LLM training cycles. They serve merely as transient inference accelerators.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">4. Assignment of Intellectual Property for Outputs</h3>
                            <p>Any generated text, logic, outreach messaging, synthesized summaries, or calculated lead scoring equations (the "Outputs") derived dynamically from your specific datasets (the "Inputs") remain the total intellectual property of the Customer. BasaltHQ disclaims any ownership over custom AI-generated content uniquely crafted for your specific campaign sequences, placing full structural sovereignty in the hands of the Authorized User.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">5. Absolute Indemnification Regarding Algorithmic Hallucinations</h3>
                            <p>Due to the inherently probabilistic and biologically non-deterministic nature of Transformer-based AI architectures, BasaltHQ makes NO WARRANTY regarding the absolute factual accuracy, tone, or regulatory compliance of any AI-generated communication drafts. You expressly indemnify and hold BasaltHQ harmless from any financial, legal, or reputational damage incurred because a user dispatched an "AI Hallucination" without adequate pre-flight review. The AI serves as an intelligence amplifier, not a legally accountable fiduciary entity.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">6. Human-in-the-Loop Override Architecture</h3>
                            <p>Customer strictly acknowledges that all automated communications and heuristic deductions yielded by the agents must theoretically remain subject to unilateral human intercept. You assume total responsibility for configuring approval workflows and verify that a dedicated network operator will maintain supervisory review over autonomous execution protocols. Any unsupervised automation is deployed strictly at Customer's distinct, calculated operational peril.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">7. Autonomous API Execution Strictures</h3>
                            <p>While Basalt Agentic engines are granted functional capabilities allowing them to execute complex, multi-stage tasks across platforms, BasaltHQ enforces computational "circuit-breaker" constraints. Agents are hard-coded to reject the execution of unsanctioned financial modifications, deployment of irreversible destructive deletions, or the initiation of mass outbound traffic exceeding velocity constraints. The Customer assumes full sovereign accountability over their configuration.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">8. Optimization and Synthetic Fine-Tuning Metadata</h3>
                            <p>In order to provide continual compounding value to the global software ecosystem, BasaltCRM reserves the right to capture and anonymize interaction telemetry regarding AI outputs. This includes metrics such as AI click-through success rates, execution interruption anomalies, and human-in-the-loop editing distances on drafts. Immediate programmatic scrubbing explicitly redacts Personal Identifiable Information (PII) before this data interacts with our engineering logging networks.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">9. European Union (EU AI Act) Model Categorizations</h3>
                            <p>BasaltHQ classifies its CRM generative tools under a "Limited to Minimal Risk" categorization matrix beneath contemporary EU AI Act legislation frameworks. We transparently disclose the non-human origin of synthetic text whenever strictly mandated by jurisdictional rule and specifically prohibit the application of our toolsets for high-risk biometric profiling, deceptive interaction mechanisms, or predatory manipulative tactics.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">10. Limitation of Liability on Generative Synthesis</h3>
                            <p>Notwithstanding any standard indemnification clause, BasaltHQ capably disavows and limits total liability concerning any financial deficit, missed sales opportunities, delayed communication pipelines, or infrastructural lag brought about by third-party cognitive model outages or inference latency events.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">11. Force Majeure on Computational API Networks</h3>
                            <p>BasaltHQ maintains robust failovers; however, sweeping geographical GPU cluster blackouts or fundamental core foundational provider bankruptcies (e.g., severe multi-day OpenAI API failure cascades) are classified legally as Force Majeure events. Service Level Agreements measuring system uptime explicitly exclude any third-party deep-learning orchestration down-scaling.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">12. Third-Party End-User License Agreement Cascades</h3>
                            <p>Customer unequivocally assents to be derivatively bound by the specific End User License Agreements, Trust and Safety policies, and Acceptable Use paradigms propagated by our foundational engine sub-processors, mapping down through the technological stack.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">13. Regulatory Audit and Inference Inspection Mechanisms</h3>
                            <p>Upon reasonable suspicion of algorithmic exploitation or the systemic abuse of our synthetic routing infrastructures, BasaltHQ reserves the absolute mandate to initiate internal inference audits across Customer accounts to ensure compliance with our anti-spam and toxicity detection matrices.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">14. Systemic Ejection Protocols for Malicious Injections</h3>
                            <p>Any attempt by an Authorized User to fundamentally override, subvert, or deploy "Prompt Injection", "Jailbreaking Sequences", or "Adversarial Syntactics" designed to breach standard operational bounds of the Agentic AI structure will result in an immediate forfeiture of the account ledger without the possibility of prorated remission.</p>
                         </section>

                         <section className="space-y-4">
                            <h3 className="text-white font-bold text-lg border-l-2 border-amber-500 pl-3">15. Final Acknowledgment of Experimental Architectures</h3>
                            <p>You acknowledge that you are interacting with highly experimental, probabilistic architectures operating at the precipice of current theoretical computer science. Continuous deployment and active testing are fundamental paradigms of our delivery vector.</p>
                         </section>

                         <div className="pt-12 pb-8 flex flex-col items-center gap-4">
                            <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
                            {dataPolicyRead ? (
                               <Button 
                                  onClick={() => setOpenDataPolicy(false)} 
                                  className="text-[11px] font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 h-auto rounded-full transition-all duration-300 transform hover:scale-105"
                               >
                                  Execution Authorized ✓
                               </Button>
                            ) : (
                               <span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                                  Scroll to bottom to electronically sign
                               </span>
                            )}
                         </div>
                      </div>
                   </DialogContent>
                </Dialog>

                {process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY && (
                  <FormField
                    control={form.control}
                    name="turnstile_token"
                    render={({ field }) => (
                      <FormItem className="flex justify-center">
                        <FormControl>
                          <Turnstile
                            siteKey={process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY!}
                            onSuccess={(token) => field.onChange(token)}
                            options={{ theme: 'dark' }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            <div className="grid gap-2 py-6">
              {!allStepsComplete && (
                <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 border border-white/10 rounded-2xl p-5 mb-4 shadow-xl shadow-black/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">Required to Proceed</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-2">
                    {requiredSteps.map(step => (
                      <div key={step.id} className={cn("text-[10px] uppercase font-bold tracking-wider flex items-center gap-2 transition-colors duration-500", step.isComplete ? "text-emerald-500" : "text-zinc-500")}>
                        {step.isComplete ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-dashed border-zinc-700 shrink-0" />}
                        {step.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button disabled={isLoading || !form.formState.isValid} type="submit" className={cn("w-full py-6 font-bold text-lg transition-all duration-300", form.formState.isValid ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 transform hover:-translate-y-0.5" : "")}>
                Activate Intelligence Engine
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4 pt-0">
        <div className="text-sm text-gray-500 text-center">
          Already have an account? <Link href="/sign-in" className="text-primary hover:underline font-bold">sign-in</Link>
        </div>
      </CardFooter>
    </Card>
  );
}
