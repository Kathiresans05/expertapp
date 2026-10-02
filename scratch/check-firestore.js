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

async function main() {
  console.log('--- FIRESTORE EXPERTS ---');
  const expertsSnap = await db.collection('experts').get();
  expertsSnap.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, '=> name:', data.name, 'phone:', data.phone || data.mobileNumber, 'isApproved:', data.isApproved);
  });

  console.log('\n--- FIRESTORE USERS ---');
  const usersSnap = await db.collection('users').get();
  usersSnap.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, '=> name:', data.name, 'phone:', data.phone || data.mobileNumber, 'role:', data.role);
  });
}

main().catch(console.error);
