
import { prismadb } from "@/lib/prisma";
import { AiProvider } from "@prisma/client";
// import { Button } from "@/components/ui/button"; // Moved
// import { Input } from "@/components/ui/input"; // Moved
// import { Switch } from "@/components/ui/switch"; // Moved
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { revalidatePath } from "next/cache";

import { AiModelRow } from "./_components/AiModelRow";

import Container from "@/app/[locale]/(routes)/components/ui/Container";

// ... existing imports ...

const AiPricingPage = async () => {
    const models = await prismadb.aiModel.findMany({
        orderBy: [{ provider: 'asc' }, { name: 'asc' }]
    });

    return (
        <Container
            title="AI Model Pricing & Configuration"
            description="Manage pricing and active status for AI models."
        >
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Provider</TableHead>
                            <TableHead>Model Name</TableHead>
                            <TableHead>Model ID</TableHead>
                            <TableHead>Input Price ($/1k)</TableHead>
                            <TableHead>Output Price ($/1k)</TableHead>
                            <TableHead>Active</TableHead>
                            <TableHead>Default</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {models.map((model) => (
                            <AiModelRow key={model.id} model={model} />
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Container>
    );
};

export default AiPricingPage;
