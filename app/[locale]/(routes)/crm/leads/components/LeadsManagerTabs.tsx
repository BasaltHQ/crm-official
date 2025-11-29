"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import LeadsView from "./LeadsView";
import ProcessPanel from "./ProcessPanel";
import DialerPanel from "../../dialer/DialerPanel";

type Props = {
  leads: any[];
  crmData: any;
  defaultTab?: "all" | "workspace" | "dialer";
};

export default function LeadsManagerTabs({ leads, crmData, defaultTab = "all" }: Props) {
  return (
    <div className="w-full h-full flex flex-col">
      <Tabs defaultValue={defaultTab} className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <TabsList>
            <TabsTrigger value="all">All Leads</TabsTrigger>
            <TabsTrigger value="workspace">Leads Workspace</TabsTrigger>
            <TabsTrigger value="dialer">Dialer</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="all" className="overflow-auto flex-1">
          <LeadsView crmData={crmData} data={leads} />
        </TabsContent>
        <TabsContent value="workspace" className="overflow-auto flex-1">
          <ProcessPanel leads={leads as any} crmData={crmData} />
        </TabsContent>
        <TabsContent value="dialer" className="overflow-auto flex-1">
          <DialerPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
