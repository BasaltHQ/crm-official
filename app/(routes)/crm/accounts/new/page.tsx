import { getAllCrmData } from "@/actions/crm/get-crm-data";
import Container from "@/app/(routes)/components/ui/Container";
import { NewAccountFormWrapper } from "./components/NewAccountFormWrapper";

const NewAccountPage = async () => {
    const { users, industries } = await getAllCrmData();

    return (
        <Container
            title="Create New Account"
            description="Add a new company account to your CRM."
        >
            <div className="bg-card p-6 rounded-lg border shadow-sm max-w-4xl mx-auto">
                <NewAccountFormWrapper
                    users={users}
                    industries={industries}
                />
            </div>
        </Container>
    );
};

export default NewAccountPage;
