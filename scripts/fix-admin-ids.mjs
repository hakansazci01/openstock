import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/openstock";
const EMAIL = "hakansazci@gmail.com";

async function main() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db("openstock");

    const user = await db.collection("user").findOne({ email: EMAIL });
    if (!user) {
        console.log("❌ Kullanıcı bulunamadı!");
        process.exit(1);
    }

    const userIdStr = user._id.toString();
    console.log(`👤 Kullanıcı bulundu: ${user.email}`);
    console.log(`   _id: ${user._id}`);
    console.log(`   id (string): ${userIdStr}`);
    console.log(`   Mevcut id alanı: ${user.id || "YOK"}`);

    // 1. Add `id` field to user if missing
    if (!user.id) {
        await db.collection("user").updateOne(
            { _id: user._id },
            { $set: { id: userIdStr } }
        );
        console.log(`✅ Kullanıcıya 'id' alanı eklendi: ${userIdStr}`);
    }

    // 2. Fix account userId - must be string, not ObjectId
    const accounts = await db.collection("account").find({ accountId: EMAIL }).toArray();
    for (const acc of accounts) {
        const accUserIdStr = typeof acc.userId === 'string' ? acc.userId : acc.userId.toString();
        if (acc.userId !== accUserIdStr || !acc.id) {
            await db.collection("account").updateOne(
                { _id: acc._id },
                { 
                    $set: { 
                        userId: userIdStr,
                        id: acc.id || new ObjectId().toString()
                    } 
                }
            );
            console.log(`✅ Hesap güncellendi: userId=${userIdStr}, id=${acc.id || "yeni"}`);
        } else {
            console.log(`✅ Hesap zaten doğru: userId=${acc.userId}, id=${acc.id}`);
        }
    }

    // Verify
    const updatedUser = await db.collection("user").findOne({ email: EMAIL });
    const updatedAccount = await db.collection("account").findOne({ accountId: EMAIL, providerId: "email" });

    console.log(`\n👤 Nihai durum:`);
    console.log(`   User id: ${updatedUser.id}`);
    console.log(`   User role: ${updatedUser.role}`);
    console.log(`   Account userId: ${updatedAccount?.userId}`);
    console.log(`   Account id: ${updatedAccount?.id}`);
    console.log(`   Eşleşiyor: ${updatedUser.id === updatedAccount?.userId ? "✅ EVET" : "❌ HAYIR"}`);

    await client.close();
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Hata:", err);
    process.exit(1);
});