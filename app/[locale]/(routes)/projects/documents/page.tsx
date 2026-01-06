import React, { Suspense } from "react";
import Container from "../../components/ui/Container";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SuspenseLoading from "@/components/loadings/suspense";
import GlobalDocumentsView from "./components/GlobalDocumentsView";

export const maxDuration = 300;

const DocumentsPage = async () => {
    const session = await getServerSession(authOptions);

    if (!session) return redirect("/sign-in");

    return (
        <Container
            title="Documents"
            description="All documents across your projects"
        >
            <Suspense fallback={<SuspenseLoading />}>
                <GlobalDocumentsView />
            </Suspense>
        </Container>
    );
};

export default DocumentsPage;
