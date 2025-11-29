"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CalendarIntegrationPanel from "./CalendarIntegrationPanel";
import CalendarAvailabilityPanel from "./CalendarAvailabilityPanel";
import CalendarEventsPanel from "./CalendarEventsPanel";
import SignaturesResourcesPanel from "./SignaturesResourcesPanel";

type SettingsTabsProps = {
    defaultTab?: "integration" | "availability" | "events" | "signatures";
};

export default function SettingsTabs({ defaultTab = "integration" }: SettingsTabsProps) {
    return (
        <div className="w-full h-full flex flex-col">
            <Tabs defaultValue={defaultTab} className="w-full h-full flex flex-col">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <TabsList>
                        <TabsTrigger value="integration">Integration</TabsTrigger>
                        <TabsTrigger value="availability">Availability</TabsTrigger>
                        <TabsTrigger value="events">Events</TabsTrigger>
                        <TabsTrigger value="signatures">Signatures & Resources</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="integration" className="overflow-auto flex-1">
                    <div className="space-y-6">
                        <CalendarIntegrationPanel />
                    </div>
                </TabsContent>

                <TabsContent value="availability" className="overflow-auto flex-1">
                    <div className="space-y-6">
                        <CalendarAvailabilityPanel />
                    </div>
                </TabsContent>

                <TabsContent value="events" className="overflow-auto flex-1">
                    <div className="space-y-6">
                        <CalendarEventsPanel />
                    </div>
                </TabsContent>

                <TabsContent value="signatures" className="overflow-auto flex-1">
                    <div className="space-y-6">
                        <SignaturesResourcesPanel />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
