import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

import * as fs from 'fs';
import * as path from 'path';

const docs = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts', 'docs-data.json'), 'utf-8'));

async function main() {
    console.log("Start seeding documentation...");

    // Clear existing docs
    await prisma.docArticle.deleteMany({});
    console.log("Cleared existing articles.");

    // Insert new docs
    for (const doc of docs) {
        await prisma.docArticle.create({
            data: {
                title: doc.title,
                slug: doc.slug,
                category: doc.category,
                order: doc.order,
                content: doc.content.trim(),
            }
        });
        console.log(`Created article: ${doc.title}`);
    }

    console.log("Seeding finished.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
