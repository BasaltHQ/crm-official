import { getAllCrmData } from "@/actions/crm/get-crm-data";
import Container from "@/app/(routes)/components/ui/Container";
import { NewContactFormWrapper } from "./components/NewContactFormWrapper";

const NewContactPage = async () => {
    const { users, accounts } = await getAllCrmData();

    return (
        <Container
            title="Create New Contact"
            description="Add a new contact to your CRM."
        >
            <div className="bg-card p-6 rounded-lg border shadow-sm max-w-4xl mx-auto">
                <NewContactFormWrapper
                    users={users}
                    accounts={accounts}
                />
            </div>
        </Container>
    );
};

export default NewContactPage;
