const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

const privateKey = process.env.FIREBASE_PRIVATE_KEY 
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    })
  });
}

const db = getFirestore();

const DUMMY_NAMES = [
  'priya sharma',
  'kavya raman',
  'anitha krishnan',
  'divya nair',
  'sneha reddy',
  'sarah jenkins',
  'rajesh',
  'sarah',
  'monica'
];

const DUMMY_PHONES = [
  '9876543210',
  '9876543211',
  '9876543212',
  '9876543213',
  '9876543214',
];

async function deleteMockExpertsAndUsers() {
  console.log('=== CLEANING FIRESTORE MOCK / SEED DATA ===\n');

  // 1. Clean experts collection
  const expertsSnap = await db.collection('experts').get();
  let deletedExpertsCount = 0;

  for (const doc of expertsSnap.docs) {
    const data = doc.data();
    const name = (data.name || (data.user ? data.user.name : '') || '').toLowerCase().trim();
    const phone = (data.phone || data.mobileNumber || '').replace('+91', '').trim();

    const isDummyName = DUMMY_NAMES.some(dn => name.includes(dn));
    const isDummyPhone = DUMMY_PHONES.some(dp => phone.includes(dp)) || phone.startsWith('9999999');
    const isMockPrefix = name.startsWith('expert ');
    const isEmpty = !name && !phone;

    if (isDummyName || isDummyPhone || isMockPrefix || isEmpty) {
      console.log(`[DELETED EXPERT] docId: ${doc.id} | name: "${data.name}" | phone: "${phone}"`);
      await db.collection('experts').doc(doc.id).delete();
      deletedExpertsCount++;
    }
  }

  // 2. Clean users collection
  const usersSnap = await db.collection('users').get();
  let deletedUsersCount = 0;

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const name = (data.name || '').toLowerCase().trim();
    const phone = (data.phone || data.mobileNumber || '').replace('+91', '').trim();

    const isDummyName = DUMMY_NAMES.some(dn => name.includes(dn));
    const isDummyPhone = DUMMY_PHONES.some(dp => phone.includes(dp)) || phone.startsWith('9999999');
    const isEmpty = !name && !phone;

    if (isDummyName || isDummyPhone || isEmpty) {
      console.log(`[DELETED USER] docId: ${doc.id} | name: "${data.name}" | phone: "${phone}"`);
      await db.collection('users').doc(doc.id).delete();
      deletedUsersCount++;
    }
  }

  console.log(`\nCleanup Finished!`);
  console.log(`- Deleted ${deletedExpertsCount} mock experts from Firestore`);
  console.log(`- Deleted ${deletedUsersCount} mock/empty users from Firestore`);
}

deleteMockExpertsAndUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error during cleanup:', err);
    process.exit(1);
  });
