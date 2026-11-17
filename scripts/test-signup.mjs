import { MongoClient } from "mongodb";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/openstock";
const EMAIL = "hakansazci@gmail.com";
const PASSWORD = "05458054612Op";
const NAME = "Hakan Borsa Analizi";

async function main() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db("openstock");

    // Delete existing user
    await db.collection("user").deleteMany({ email: EMAIL });
    await db.collection("account").deleteMany({ accountId: EMAIL });
    console.log("🗑️ Eski kayıtlar silindi.");

    const authInstance = betterAuth({
        database: mongodbAdapter(db),
        secret: process.env.BETTER_AUTH_SECRET,
        baseURL: process.env.BETTER_AUTH_URL,
        emailAndPassword: {
            enabled: true,
            disableSignUp: false,
            requireEmailVerification: false,
            minPasswordLength: 8,
            maxPasswordLength: 128,
        },
    });

    try {
        const response = await authInstance.api.signUpEmail({
            body: {
                email: EMAIL,
                password: PASSWORD,
                name: NAME,
            },
        });
        console.log("✅ Sign-up successful!");
        console.log("Response:", JSON.stringify(response, null, 2).substring(0, 500));

        // Update role to admin
        const user = await db.collection("user").findOne({ email: EMAIL });
        if (user) {
            await db.collection("user").updateOne(
                { _id: user._id },
                { $set: { role: "admin" } }
            );
            console.log("✅ Rol admin olarak güncellendi.");
        }
    } catch (e) {
        console.log("❌ Sign-up failed:");
        console.log("Error:", e.message);
        console.log("Code:", e.code);
        console.log("Status:", e.status);
    }

    await client.close();
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Script error:", err);
    process.exit(1);
});