import { MongoClient } from "mongodb";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";


const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/openstock";

async function main() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const database = client.db("openstock");

    const authInstance = betterAuth({
        database: mongodbAdapter(database),
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
        const response = await authInstance.api.signInEmail({
            body: {
                email: "hakansazci@gmail.com",
                password: "05458054612Op",
            },
        });
        console.log("✅ Sign-in successful!");
        console.log("Response:", JSON.stringify(response, null, 2).substring(0, 500));
    } catch (e) {
        console.log("❌ Sign-in failed:");
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