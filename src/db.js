// src/db.js — all Firebase touchpoints. Four functions + a configured flag.
import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, push, set, update, onValue, serverTimestamp,
} from 'firebase/database';

const env = import.meta.env;
export const configured = Boolean(env.VITE_FIREBASE_DATABASE_URL);

let db = null;
if (configured) {
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  db = getDatabase(app);
}

export async function createSync(config) {
  const r = push(ref(db, 'syncs'));
  await set(r, { ...config, createdAt: serverTimestamp() });
  return r.key;
}

export function subscribeSync(id, cb) {
  return onValue(
    ref(db, `syncs/${id}`),
    snap => cb(snap.val()),
    () => cb(null), // permission/network error → treat as not found
  );
}

export function updateSync(id, fields) {
  return update(ref(db, `syncs/${id}`), fields);
}

export function saveGrid(id, name, gridStr) {
  return set(ref(db, `syncs/${id}/people/${name}`), gridStr);
}
