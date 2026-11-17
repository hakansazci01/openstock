import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/openstock";
const EMAIL = "hakansazci@gmail.com";

async function main() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db("openstock");

    console.log("=== KULLANICI LER ===");
    const users = await db.collection("user").find({ email: EMAIL }).toArray();
    users.forEach(u => {
        console.log(`  _id: ${u._id}, id: ${u.id}, email: ${u.email}, role: ${u.role}, name: ${u.name}`);
    });

    console.log("\n=== HESAP LAR ===");
    const accounts = await db.collection("account").find({ accountId: EMAIL, providerId: "email" }).toArray();
    accounts.forEach(a => {
        console.log(`  _id: ${a._id}, id: ${a.id}, userId: ${a.userId}, providerId: ${a.providerId}, hasPassword: ${!!a.password}`);
    });

    // Check for orphaned accounts (userId is ObjectId not string)
    console.log("\n=== TÜM HESAP LAR (bu e-posta için) ===");
    const allAccounts = await db.collection("account").find({ accountId: EMAIL }).toArray();
    allAccounts.forEach(a => {
        console.log(`  _id: ${a._id}, id: ${a.id}, userId: ${a.userId} (${typeof a.userId}), providerId: ${a.providerId}`);
    });

    await client.close();
}

main().catch((err) => {
    console.error("❌ Hata:", err);
    process.exit(1);
});