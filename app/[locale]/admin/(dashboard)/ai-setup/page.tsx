
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import TeamAiSettings from "@/app/[locale]/(routes)/settings/team/_components/TeamAiSettings";
import { redirect } from "next/navigation";
import { prismadb } from "@/lib/prisma";

export default async function AdminTeamAiPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) redirect("/sign-in");

    const user = await prismadb.users.findUnique({
        where: { email: session.user.email },
        select: { team_id: true }
    });

    if (!user || !user.team_id) {
        return (
            <Container title="Team AI Settings" description="No team found.">
                <div>Please join a team to configure AI settings.</div>
            </Container>
        )
    }

    return (
        <Container
            title="Team AI Settings"
            description="Manage your Team's AI preferences. You can use the System Keys (default) or bring your own API keys."
        >
            <div className="max-w-4xl space-y-8">
                <TeamAiSettings teamId={user.team_id} />
            </div>
        </Container>
    );
}
