
export { };
const { PrismaClient } = require('@prisma/client');
const prismadb = new PrismaClient();

async function checkXoinPay() {
    try {
        const account = await prismadb.crm_Accounts.findFirst({
            where: { name: { contains: "Xoin", mode: "insensitive" } },
            include: { opportunities: true }
        });

        if (account) {
            console.log("Account found:", account.name);
            console.log("Opportunities count:", account.opportunities.length);
            console.log("Opportunities:", JSON.stringify(account.opportunities, null, 2));
        } else {
            console.log("Account not found");
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prismadb.$disconnect();
    }
}

checkXoinPay();
