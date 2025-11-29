import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import React from "react";

interface ContainerProps {
  title: string;
  description: string;
  visibility?: string;
  children: React.ReactNode;
}

const Container = ({
  title,
  description,
  visibility,
  children,
}: ContainerProps) => {
  return (
    <div className="flex-1 min-h-screen space-y-4 p-4 md:p-6 lg:p-8 pt-6 border-l overflow-auto">
      <Heading
        title={title}
        description={description}
        visibility={visibility}
      />
      <Separator />
      <div className="text-sm min-h-screen pb-24 md:pb-28 lg:pb-32 space-y-5">
        {children}
      </div>
    </div>
  );
};

export default Container;
