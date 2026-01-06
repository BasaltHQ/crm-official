"use client";

import React from "react";
import { Coins } from "lucide-react";
import { usePathname } from "next/navigation";
import MenuItem from "./MenuItem";

type Props = {
  open: boolean;
  localizations: any;
  isMobile?: boolean;
};

const CrmModuleMenu = ({ open, localizations, isMobile = false }: Props) => {
  const pathname = usePathname();
  // Match /crm paths but exclude /crm/university which has its own menu item
  const isPath = /^\/([a-z]{2}\/)?crm(\/|$)/.test(pathname) && !pathname.includes("/crm/university");

  return (
    <MenuItem
      href="/crm/dashboard"
      icon={Coins}
      title={localizations.title}
      isOpen={open}
      isActive={isPath}
      isMobile={isMobile}
    />
  );
};

export default CrmModuleMenu;
