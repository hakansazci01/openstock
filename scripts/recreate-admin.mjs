import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcrypt";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/openstock";
const EMAIL = "hakansazci@gmail.com";
const PASSWORD = "05458054612Op";
const NAME = "Hakan Borsa Analizi";

async function main() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db("openstock");

    const now = new Date();
    const hash = await bcrypt.hash(PASSWORD, 12);

    // Delete existing records to start fresh
    await db.collection("user").deleteMany({ email: EMAIL });
    await db.collection("account").deleteMany({ accountId: EMAIL });
    console.log(`🗑️ Eski kayıtlar silindi.`);

    // Create user with proper id field
    const userId = new ObjectId().toString();
    const userIdObj = new ObjectId(userId);

    await db.collection("user").insertOne({
        _id: userIdObj,
        id: userId,
        email: EMAIL,
        name: NAME,
        role: "admin",
        emailVerified: true,  // boolean, not Date
        createdAt: now,
        updatedAt: now,
    });
    console.log(`✅ Kullanıcı oluşturuldu: ${EMAIL}`);

    // Create account with Better Auth credential provider schema:
    // providerId = "credential", accountId = user.id
    await db.collection("account").insertOne({
        _id: new ObjectId(),
        id: new ObjectId().toString(),
        userId: userId,
        accountId: userId,
        providerId: "credential",
        password: hash,
        createdAt: now,
        updatedAt: now,
    });
    console.log(`✅ Hesap oluşturuldu (providerId: credential, accountId: user.id).`);

    // Verify
    const user = await db.collection("user").findOne({ email: EMAIL });
    const account = await db.collection("account").findOne({ accountId: userId, providerId: "credential" });

    console.log(`\n👤 Nihai durum:`);
    console.log(`   User id: ${user.id}`);
    console.log(`   User role: ${user.role}`);
    console.log(`   User email: ${user.email}`);
    console.log(`   User emailVerified: ${user.emailVerified}`);
    console.log(`   Account userId: ${account.userId}`);
    console.log(`   Account id: ${account.id}`);
    console.log(`   Account password hash: ${account.password?.substring(0, 20)}...`);
    console.log(`   ID eşleşiyor: ${user.id === account.userId ? "✅ EVET" : "❌ HAYIR"}`);

    await client.close();
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Hata:", err);
    process.exit(1);
});