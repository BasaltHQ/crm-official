"use client";

import React, { createContext, useContext } from "react";

interface PermissionsContextType {
    permissions: string[];
    isSuperAdmin: boolean;
}

const PermissionsContext = createContext<PermissionsContextType>({
    permissions: [],
    isSuperAdmin: false,
});

export const PermissionsProvider = ({
    children,
    permissions = [],
    isSuperAdmin = false
}: {
    children: React.ReactNode;
    permissions: string[];
    isSuperAdmin?: boolean;
}) => {
    return (
        <PermissionsContext.Provider value={{ permissions, isSuperAdmin }}>
            {children}
        </PermissionsContext.Provider>
    );
};

export const usePermission = () => {
    const context = useContext(PermissionsContext);

    // Helper to check access
    const hasAccess = (requiredPermission: string) => {
        if (context.isSuperAdmin) return true;
        if (!context.permissions) return false;

        // 1. Direct match or wildcard
        if (context.permissions.includes('*') || context.permissions.includes(requiredPermission)) return true;

        // 2. Parent match (if parent is selected, usually implies child access OR we treat parent as container)
        // Actually, our logic is: selecting parent selects children in UI.
        // But what if we just have 'leads' (legacy)? 
        if (context.permissions.includes(requiredPermission.split('.')[0])) return true; // Loose check? 
        // Better: explicit checks. 

        // If I have 'leads.tabs.all', do I need 'leads'?
        // Yes.

        return context.permissions.includes(requiredPermission);
    };

    return { ...context, hasAccess };
};
