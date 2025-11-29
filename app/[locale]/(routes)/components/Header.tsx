import Feedback from "./Feedback";
import FulltextSearch from "./FulltextSearch";
import AvatarDropdown from "./ui/AvatarDropdown";

import { Separator } from "@/components/ui/separator";
import { SetLanguage } from "@/components/SetLanguage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandComponent } from "@/components/CommandComponent";
import SupportComponent from "@/components/support";

type Props = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  lang: string;
};

const Header = ({ id, name, email, avatar, lang }: Props) => {
  return (
    <>
      <div className="glass rounded-xl sticky top-0 z-30 flex h-20 justify-between items-center px-4 md:px-6 lg:px-8 py-3 space-x-5">
        <div className="flex-1 min-w-0">
          <FulltextSearch />
        </div>
        <div className="flex items-center gap-3">
          <CommandComponent />
          <SetLanguage userId={id} />
          <Feedback />
          <ThemeToggle />
          <SupportComponent />
          <AvatarDropdown
            avatar={avatar}
            userId={id}
            name={name}
            email={email}
          />
        </div>
      </div>
      <Separator />
    </>
  );
};

export default Header;
