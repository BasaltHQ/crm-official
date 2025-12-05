import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
    const email = "admin@ledger1.com";
    const password = "password123";
    const hashedPassword = await bcrypt.hash(password, 12);

    const existingUser = await prisma.users.findUnique({
        where: { email },
    });

    if (existingUser) {
        console.log("Admin user already exists. Updating to ensure admin privileges...");
        await prisma.users.update({
            where: { email },
            data: {
                is_admin: true,
                password: hashedPassword // Reset password to ensure access
            },
        });
    } else {
        console.log("Creating new admin user...");
        await prisma.users.create({
            data: {
                email,
                name: "Admin User",
                password: hashedPassword,
                is_admin: true,
                userStatus: "ACTIVE",
            },
        });
    }

    console.log("Admin user seeded successfully.");
    console.log("Email: " + email);
    console.log("Password: " + password);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
