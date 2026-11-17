import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://root:DDEE2F31DCB4E082969A5E959E0694C5CC982BF6C7376953@127.0.0.1:27017/openstock?authSource=admin';

async function main() {
    await mongoose.connect(MONGODB_URI, { bufferCommands: false, family: 4 });
    const db = mongoose.connection.db;
    
    const user = await db.collection('user').findOne({ email: 'hakansazci@gmail.com' });
    if (!user) {
        console.log('Kullanıcı bulunamadı!');
        process.exit(1);
    }
    
    await db.collection('user').updateOne(
        { _id: user._id },
        { $set: { role: 'admin' } }
    );
    
    console.log('Kullanıcı admin yapıldı:', user.email);
    console.log('Rol: admin');
    
    await mongoose.connection.close();
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
