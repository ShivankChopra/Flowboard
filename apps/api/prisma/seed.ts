import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { resetAndSeedDemoData } from "../src/demo/demo-seed";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString })
});

resetAndSeedDemoData(prisma)
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (error) => {
		console.error(error);
		await prisma.$disconnect();
		process.exit(1);
	});
