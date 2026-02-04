"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Clock,
    Mail,
    MessageSquare,
    CheckSquare,
    Bell,
    Plus
} from "lucide-react";

interface NodePaletteProps {
    onAddNode: (type: string, label: string) => void;
}

const nodeOptions = [
    {
        type: "delay",
        label: "Wait",
        description: "Pause before next step",
        icon: Clock,
        color: "text-blue-500",
    },
    {
        type: "action",
        label: "Send Email",
        description: "Send an email",
        icon: Mail,
        color: "text-green-500",
        data: { actionType: "send_email" },
    },
    {
        type: "action",
        label: "Send SMS",
        description: "Send a text message",
        icon: MessageSquare,
        color: "text-green-500",
        data: { actionType: "send_sms" },
    },
    {
        type: "action",
        label: "Create Task",
        description: "Create a task for team",
        icon: CheckSquare,
        color: "text-green-500",
        data: { actionType: "create_task" },
    },
    {
        type: "action",
        label: "Notify",
        description: "Send notification",
        icon: Bell,
        color: "text-green-500",
        data: { actionType: "notify" },
    },
];

export function NodePalette({ onAddNode }: NodePaletteProps) {
    return (
        <Card className="w-[200px] shadow-lg">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">Add Steps</CardTitle>
                <CardDescription className="text-xs">
                    Click to add to canvas
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
                {nodeOptions.map((option, index) => {
                    const Icon = option.icon;
                    return (
                        <Button
                            key={`${option.type}-${index}`}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start gap-2 h-auto py-2"
                            onClick={() => onAddNode(option.type, option.label)}
                        >
                            <Icon className={`h-4 w-4 ${option.color}`} />
                            <div className="text-left">
                                <div className="text-sm font-medium">{option.label}</div>
                                <div className="text-xs text-muted-foreground">
                                    {option.description}
                                </div>
                            </div>
                        </Button>
                    );
                })}
            </CardContent>
        </Card>
    );
}
