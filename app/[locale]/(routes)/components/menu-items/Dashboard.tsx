import { Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import React from "react";

type Props = {
  open: boolean;
  title: string;
};

const DashboardMenu = ({ open, title }: Props) => {
  const pathname = usePathname();
  // Mark active when the current path ends with "/dashboard" (locale-aware, e.g., /en/dashboard)
  const isPath = pathname.endsWith("/dashboard");
  return (
    <div className="flex flex-row items-center p-2 w-full">
      <Link
        href={"/dashboard"}
        className={`menu-item ${isPath ? "menu-item-active" : ""}`}
        title={title}
      >
        <Home className="w-6 icon" />
        <span className={open ? "" : "hidden"}>{title}</span>
      </Link>
    </div>
  );
};

export default DashboardMenu;
