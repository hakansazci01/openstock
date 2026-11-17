import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGODB_URI);

const db = mongoose.connection.db;
const role = process.argv[2] ?? 'admin';
const res = await db.collection('user').updateOne({ email: 'testbot@example.com' }, { $set: { role } });
console.log('role set to', role, 'modified:', res.modifiedCount);
process.exit(0);
