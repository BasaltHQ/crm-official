"use client";

import { useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { createWorkflow } from "@/actions/crm/workflows";
import { toast } from "sonner";

const formSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional(),
    trigger_type: z.string().min(1, "Select a trigger"),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateWorkflowDialogProps {
    teamId: string;
    children: ReactNode;
}

const triggerOptions = [
    { value: "DEAL_ROOM_OPENED", label: "DealRoom Opened", description: "When a client opens a DealRoom link" },
    { value: "SENTIMENT_NEGATIVE", label: "Negative Sentiment", description: "When call sentiment is detected as negative" },
    { value: "LEAD_CREATED", label: "Lead Created", description: "When a new lead is added" },
    { value: "FORM_SUBMITTED", label: "Form Submitted", description: "When a form submission is received" },
    { value: "MANUAL", label: "Manual Trigger", description: "Triggered manually via API or button" },
];

export function CreateWorkflowDialog({ teamId, children }: CreateWorkflowDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            description: "",
            trigger_type: "",
        },
    });

    const onSubmit = async (values: FormValues) => {
        setLoading(true);

        // Create with empty nodes/edges - user will edit in canvas
        const result = await createWorkflow({
            name: values.name,
            description: values.description,
            trigger_type: values.trigger_type,
            team_id: teamId,
            nodes: [
                // Add default trigger node
                {
                    id: "trigger-1",
                    type: "trigger",
                    position: { x: 250, y: 50 },
                    data: {
                        label: triggerOptions.find(t => t.value === values.trigger_type)?.label || "Trigger",
                        triggerType: values.trigger_type
                    },
                },
            ],
            edges: [],
        });

        if (result.success && result.workflow) {
            toast.success("Workflow created! Opening editor...");
            setOpen(false);
            form.reset();
            router.push(`/crm/workflows/${result.workflow.id}`);
        } else {
            toast.error(result.error || "Failed to create workflow");
        }

        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create New Workflow</DialogTitle>
                    <DialogDescription>
                        Set up the basics, then design your workflow in the visual editor.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Workflow Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="e.g., Follow-up on DealRoom View"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="What does this workflow do?"
                                            className="resize-none"
                                            rows={2}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="trigger_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Trigger</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="What starts this workflow?" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {triggerOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    <div className="flex flex-col">
                                                        <span>{option.label}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {option.description}
                                                        </span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Choose what event will start this workflow
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create & Edit
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
