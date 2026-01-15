
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const account = await prisma.crm_Accounts.findFirst({
        where: {
            name: {
                contains: "Xoinpay",
                mode: "insensitive"
            }
        }
    });

    if (account) {
        console.log("Account FOUND:", account);
    } else {
        console.log("Account NOT found.");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
