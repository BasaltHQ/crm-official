import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { TeamEmailSettings } from "@/app/[locale]/(routes)/settings/team/_components/TeamEmailSettings";
import { EmailDeliveryStats } from "@/app/[locale]/(routes)/settings/team/_components/EmailDeliveryStats";
import { redirect } from "next/navigation";

export default async function AdminSettingsPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return redirect("/sign-in");
    }

    const user = await prismadb.users.findUnique({
        where: { email: session.user.email },
        select: { assigned_team: { select: { id: true } } }
    });

    // In a real app we'd verify 'admin' role here

    return (
        <Container title="Admin Settings" description="System-wide and Team configurations.">
            <div className="space-y-8 p-4">
                <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-500/10 rounded-r-md">
                    <h3 className="font-semibold text-blue-500">Email Configuration</h3>
                    <p className="text-sm text-muted-foreground">Manage the sender identity for mass outreach (Hammer).</p>
                </div>

                {user?.assigned_team?.id ? (
                    <>
                        <TeamEmailSettings teamId={user.assigned_team.id} />
                        <EmailDeliveryStats teamId={user.assigned_team.id} />
                    </>
                ) : (
                    <div className="p-4 bg-muted rounded-md text-sm text-muted-foreground">
                        You do not have a team assigned. Please contact support.
                    </div>
                )}
            </div>
        </Container>
    );
}
