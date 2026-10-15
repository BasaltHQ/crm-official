"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import { clearUserCache } from "@/lib/cache-utils";
import { clearImpersonation } from "@/actions/teams/switch-team";
import { logUserMetric } from "@/actions/university/log-user-metric";

import { LogOut, Settings, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useAvatarStore from "@/store/useAvatarStore";
import { BillingModal } from "@/components/modals/BillingModal";
import { useSignedUrl } from "@/hooks/use-signed-url";

type Props = {
  avatar: string;
  userId: string;
  name: string;
  email: string;
};

const AvatarDropdown = ({ avatar, userId, name, email }: Props) => {
  const router = useRouter();
  const setAvatar = useAvatarStore((state) => state.setAvatar);
  const getAvatar = useAvatarStore((state) => state.avatar);
  const [newAvatar, setNewAvatar] = useState(getAvatar);
  const [isBillingOpen, setIsBillingOpen] = useState(false);

  useEffect(() => {
    setAvatar(avatar);
  }, [avatar, setAvatar]);

  useEffect(() => {
    setNewAvatar(getAvatar);
  }, [getAvatar]);

  const { signedUrl } = useSignedUrl(newAvatar);

  //console.log(newAvatar, "newAvatar");
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Avatar>
            <AvatarImage
              src={
                signedUrl
                  ? signedUrl
                  : `/images/nouser.png`
              }
            />
            <AvatarFallback className="bg-primary text-white">
              {name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel className="space-y-1">
            <div>{name}</div>
            <div className="text-xs text-gray-500">{email}</div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => router.push(`/crm/dashboard`)}
          >
            Sales Dashboard
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsBillingOpen(true)}>
            <CreditCard className="w-4 h-4 inline-block mr-2 stroke-current text-gray-500" />
            <span>Billing & Payments</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={async () => {
              logUserMetric("viewed_settings").catch(console.error);
              router.push("/profile");
          }}>
            <Settings className="w-4 h-4 inline-block mr-2 stroke-current text-gray-500" />
            <span>Account Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={async () => {
            clearUserCache();
            await clearImpersonation();
            await signOut({ redirect: false });
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = `/sign-in?loggedOut=true`;
          }}>
            <LogOut className="w-4 h-4 inline-block mr-2 stroke-current text-gray-500" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BillingModal
        isOpen={isBillingOpen}
        onClose={() => setIsBillingOpen(false)}
      />
    </>
  );
};

export default AvatarDropdown;
