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
        <div className="flex-1 flex flex-col space-y-4 p-4 md:p-6 lg:p-8 pt-6 md:border-l overflow-hidden">
            <div className="shrink-0">
                <Heading
                    title={title}
                    description={description}
                    visibility={visibility}
                />
                <Separator className="mt-4" />
            </div>
            <div className="flex-1 overflow-y-auto text-sm pb-48 md:pb-12 space-y-5">
                {children}
            </div>
        </div>
    );
};

export default Container;
