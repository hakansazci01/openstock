
async function checkDBs() {
    const [{ default: mongoose }, { default: dotenv }, dns] = await Promise.all([
        import('mongoose'),
        import('dotenv'),
        import('node:dns'),
    ]);
    dotenv.config({ path: '.env' });
    dns.setDefaultResultOrder('ipv4first');

    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not defined in .env');

    const conn = await mongoose.createConnection(uri).asPromise();
    try {
        console.log("Connected.");

        // Check 'openstock' (current target)
        const openstockDB = conn.useDb('openstock');
        const countOpenStock = await openstockDB.collection('user').countDocuments();
        console.log(`\n📂 Database 'openstock': ${countOpenStock} users`);

        // Check 'test' (default target)
        const testDB = conn.useDb('test');
        const countTest = await testDB.collection('user').countDocuments();
        console.log(`📂 Database 'test': ${countTest} users`);

    } finally {
        await conn.close();
    }
}

checkDBs().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
