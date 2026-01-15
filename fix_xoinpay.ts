
export { };
const { PrismaClient } = require('@prisma/client');
const prismadb = new PrismaClient();

async function fix() {
    try {
        // 1. Create Account
        const account = await prismadb.crm_Accounts.create({
            data: {
                name: "XoinPay",
                status: "Active",
                type: "Customer",
                assigned_to: "693287a880deffaa87ba2d44", // Rob
                email: "contact@xoinpay.com", // Placeholder
                v: 0
            }
        });
        console.log("Created Account:", account.id);

        // 2. Create Opportunity
        const opp = await prismadb.crm_Opportunities.create({
            data: {
                name: "XoinPay - Custom APK deployment",
                account: account.id,
                sales_stage: "69292ad2864ea6892c5d7e07", // New
                type: "69292ad2864ea6892c5d7e04", // Upsale
                expected_revenue: 11460,
                budget: 11460,
                status: "ACTIVE",
                assigned_to: "693287a880deffaa87ba2d44", // Rob
                created_by: "693287a880deffaa87ba2d44",
                close_date: new Date(new Date().setDate(new Date().getDate() + 30)), // +30 days
                description: "Auto-converted from Project Request: Custom BasaltSurge container slimmed down for APK deployment."
            }
        });
        console.log("Created Opportunity:", opp.id);

    } catch (e) {
        console.error(e);
    } finally {
        await prismadb.$disconnect();
    }
}

fix();
