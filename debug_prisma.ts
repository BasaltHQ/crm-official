
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Prisma keys:", Object.keys(prisma));
    console.log("prisma.boards exists?", !!prisma.boards);
    console.log("prisma.board exists?", !!(prisma as any).board);
    console.log("prisma.Boards exists?", !!(prisma as any).Boards);

    if (prisma.boards) {
        console.log("Attempting findFirst on boards...");
        try {
            const board = await prisma.boards.findFirst();
            console.log("Board found:", board ? board.id : "none");
        } catch (e) {
            console.error("Error accessing boards:", e);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
