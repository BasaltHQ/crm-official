"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Props = {
  managerSlot: React.ReactNode;
  wizardSlot: React.ReactNode;
  poolsSlot: React.ReactNode;
  settingsSlot?: React.ReactNode;
};

export default function TabsContainer({ managerSlot, wizardSlot, poolsSlot, settingsSlot }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("tab") || "manager";

  const setTab = useCallback(
    (value: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("tab", value);
      // Preserve path and locale; replace to avoid history spam
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <Tabs value={selected} onValueChange={setTab} className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <TabsList>
          <TabsTrigger value="manager">Leads Manager</TabsTrigger>
          <TabsTrigger value="wizard">LeadGen Wizard</TabsTrigger>
          <TabsTrigger value="pools">Lead Pools</TabsTrigger>

          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
      </div>
      {selected === "manager" && (
        <TabsContent value="manager" className="overflow-auto flex-1">{managerSlot}</TabsContent>
      )}
      {selected === "wizard" && (
        <TabsContent value="wizard" className="overflow-auto flex-1">{wizardSlot}</TabsContent>
      )}
      {selected === "pools" && (
        <TabsContent value="pools" className="overflow-auto flex-1">{poolsSlot}</TabsContent>
      )}
      {selected === "settings" && (
        <TabsContent value="settings" className="overflow-auto flex-1">{settingsSlot}</TabsContent>
      )}
    </Tabs>
  );
}
