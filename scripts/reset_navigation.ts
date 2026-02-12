import { PrismaClient } from '../lib/prisma-client'

const prisma = new PrismaClient()

async function main() {
    console.log('Resetting navigation configurations...')
    // Delete all navigation configs to force fallback to code defaults
    try {
        const deleted = await prisma.navigationConfig.deleteMany({})
        console.log(`Deleted ${deleted.count} navigation configurations. System will now use defaults from lib/navigation-defaults.ts.`)
    } catch (e) {
        console.error("Error deleting configs:", e)
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
