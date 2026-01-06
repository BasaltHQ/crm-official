"use client";

import { useState } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { CalendarIcon, Linkedin, Twitter, Facebook } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";

import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

//TODO: fix all the types
type NewTaskFormProps = {
  users: any[];
  accounts: any[];
};

export function NewLeadForm({ users, accounts }: NewTaskFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const formatPhoneNumber = (value: string) => {
    // Strip everything that is not a digit
    let digits = value.replace(/\D/g, "");

    // If user deleted everything, return empty
    if (!digits) return "";

    // If it starts with 1, keep it. If not, prepending +1 will happen below?
    // Actually, let's assume if they type "619", they mean US "619".
    // If they type "1619", they mean US "619".
    // Ideally we want "+1" + digits (excluding leading 1 if present).

    if (digits.startsWith("1")) {
      digits = digits.substring(1);
    }

    // Limit to 10 digits for standard US number (or just let it grow if international support needed later, but user asked for +1)
    // "I want the +1 formatting" implies US focus.

    return `+1${digits}`;
  };


  const [isLoading, setIsLoading] = useState<boolean>(false);

  const formSchema = z.object({
    first_name: z.string(),
    last_name: z.string().min(3).max(30).nonempty(),
    company: z.string().optional(),
    jobTitle: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().min(0).max(15).optional(),
    description: z.string().optional(),
    lead_source: z.string().optional(),
    refered_by: z.string().optional(),
    // Socials
    social_twitter: z.string().optional(),
    social_facebook: z.string().optional(),
    social_linkedin: z.string().optional(),
    assigned_to: z.string().optional(),
    accountIDs: z.string().optional(),
  });

  type NewLeadFormValues = z.infer<typeof formSchema>;

  const form = useForm<NewLeadFormValues>({
    resolver: zodResolver(formSchema),
  });



  // State for duplicate dialog
  const [duplicateLeadId, setDuplicateLeadId] = useState<string | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  // ... (rest of form state)

  const onSubmit = async (data: NewLeadFormValues) => {
    setIsLoading(true);
    try {
      await axios.post("/api/crm/leads", data);
      toast({
        title: "Success",
        description: "Lead created successfully",
      });
      router.push("/crm/leads"); // Redirect to leads list
      router.refresh();
    } catch (error: any) {
      if (error.response?.status === 409) {
        const existingId = error.response.data?.leadId;
        if (existingId) {
          setDuplicateLeadId(existingId);
          setDuplicateDialogOpen(true);
        }
        toast({
          variant: "destructive",
          title: "Duplicate Detected",
          description: "A lead with this email already exists.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error?.response?.data || "Something went wrong",
        });
      }
    } finally {
      setIsLoading(false);
      // Only reset if NOT a duplicate (so they can fix it if they want)? 
      // Or if successful. Since we redirect on success, resetting is less critical there, but good practice.
      // If duplicate, we keep the form data so they see what they typed.
    }
  };

  return (
    <>
      <Form {...form}>
        {/* ... existing form ... */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="h-full px-10">
          {/* ... existing form fields ... */}
          {/* Change form reset logic inside onSubmit if needed, but here we just wrap the return */}
          {/* ... */}
          <div className="grid gap-2 py-5">
            <Button disabled={isLoading} type="submit">
              {isLoading ? (
                <span className="flex items-center animate-pulse">
                  Saving data ...
                </span>
              ) : (
                "Create lead"
              )}
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Lead Detected</DialogTitle>
            <DialogDescription>
              A lead with the email <strong>{form.getValues("email")}</strong> already exists in the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => router.push(`/crm/leads/${duplicateLeadId}`)}>View Existing Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
