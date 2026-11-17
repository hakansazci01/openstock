import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcrypt";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/openstock";
const EMAIL = "hakansazci@gmail.com";
const PASSWORD = "05458054612Op";
const NAME = "Hakan Borsa Analizi";
const ROLE = "admin";

// Better Auth MongoDB adapter schema:
//   user:  { _id: ObjectId, id: string, email, name, role, emailVerified, createdAt, updatedAt }
//   account: { _id: ObjectId, id: string, userId: string, accountId, providerId, password, createdAt, updatedAt }
//   id <-> _id mapping handled by adapter

async function main() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db("openstock");

    const existingUser = await db.collection("user").findOne({ email: EMAIL });
    const now = new Date();
    const hash = await bcrypt.hash(PASSWORD, 12);

    if (existingUser) {
        const userId = existingUser.id || existingUser._id.toString();

        await db.collection("user").updateOne(
            { _id: existingUser._id },
            { $set: { role: ROLE, name: NAME || existingUser.name, updatedAt: now } }
        );

        await db.collection("account").updateOne(
            { userId: userId, providerId: "email" },
            { $set: { password: hash, updatedAt: now } },
            { upsert: true }
        );

        console.log(`✅ Kullanıcı ${EMAIL} bulundu ve rolü '${ROLE}' olarak güncellendi.`);
        console.log(`✅ Şifre güncellendi.`);
    } else {
        const userId = new ObjectId().toString();
        const userIdObj = new ObjectId(userId);

        await db.collection("user").insertOne({
            _id: userIdObj,
            id: userId,
            email: EMAIL,
            name: NAME,
            role: ROLE,
            emailVerified: now,
            createdAt: now,
            updatedAt: now,
        });

        await db.collection("account").insertOne({
            _id: new ObjectId(),
            id: new ObjectId().toString(),
            userId: userId,
            accountId: EMAIL,
            providerId: "email",
            password: hash,
            createdAt: now,
            updatedAt: now,
        });

        console.log(`✅ Yeni yönetici kullanıcı oluşturuldu: ${EMAIL}`);
        console.log(`   Rol: ${ROLE}`);
    }

    const user = await db.collection("user").findOne({ email: EMAIL });
    const account = await db.collection("account").findOne({ accountId: EMAIL, providerId: "email" });

    console.log(`\n👤 Doğrulama:`);
    console.log(`   E-posta: ${user.email}`);
    console.log(`   Rol: ${user.role}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Account ID: ${account?.id}`);
    console.log(`   Şifre hash mevcut: ${!!account?.password}`);

    await client.close();
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Hata:", err);
    process.exit(1);
});
