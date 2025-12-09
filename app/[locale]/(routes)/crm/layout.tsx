import CrmSidebar from "./components/CrmSidebar";

export default function CrmLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* CrmSidebar - Desktop only, Fixed height */}
            <CrmSidebar />
            <div className="flex-1 min-h-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
}
