// assets/auth.js
// Handles Sign Up / Login / Logout using Firebase Authentication, and keeps
// a matching user profile in BOTH Firestore ("users/{uid}") and the
// Realtime Database ("users/{uid}"). On login, the user's Realtime
// Database record is checked as a second verification step alongside
// Firebase Auth itself.
//
// IMPORTANT: profile sync to Firestore/RTDB is treated as best-effort.
// If those writes fail (e.g. security rules not published yet), the
// core sign-in/sign-up flow still succeeds — it just logs a warning.
// This is what keeps the login modal from getting "stuck" if your
// Firestore/RTDB rules reject a write.

import { auth, db, rtdb } from "./firebase-init.js?v=5";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp as fsServerTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import {
  ref,
  set,
  get,
  update,
  serverTimestamp as rtdbServerTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Wraps a promise so it can never hang the caller forever. If it doesn't
// settle within `ms`, we treat it as failed and move on — this protects
// the whole login/signup flow from a misconfigured or unreachable
// Realtime Database / Firestore connection (e.g. wrong databaseURL).
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);
}

// Write the same profile into Firestore + Realtime Database.
// Best-effort: logs a warning instead of throwing, so a rules problem
// here never blocks the actual sign-in/sign-up from completing.
async function saveUserRecord(user, extra = {}) {
  const profileFirestore = {
    uid: user.uid,
    name: user.displayName || extra.name || "",
    email: user.email,
    updatedAt: fsServerTimestamp(),
    ...(extra.isNew ? { createdAt: fsServerTimestamp() } : {})
  };

  const profileRtdb = {
    uid: user.uid,
    name: user.displayName || extra.name || "",
    email: user.email,
    updatedAt: rtdbServerTimestamp(),
    ...(extra.isNew ? { createdAt: rtdbServerTimestamp() } : {})
  };

  try {
    await withTimeout(
      Promise.all([
        setDoc(doc(db, "users", user.uid), profileFirestore, { merge: true }),
        set(ref(rtdb, "users/" + user.uid), profileRtdb)
      ]),
      6000,
      "Profile sync"
    );
  } catch (err) {
    console.warn("[auth] profile sync to Firestore/RTDB failed or timed out:", err);
  }
}

// Confirms the signed-in user also has a matching record in RTDB.
// Never throws — returns the record, or null if missing/unreadable/slow,
// so a rules/network hiccup here can't break the login flow.
async function verifyAgainstRtdb(user) {
  try {
    const snap = await withTimeout(get(ref(rtdb, "users/" + user.uid)), 6000, "RTDB verify");
    if (!snap.exists()) return null;
    return snap.val();
  } catch (err) {
    console.warn("[auth] RTDB verification failed or timed out:", err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Public actions                                                      */
/* ------------------------------------------------------------------ */

export async function signUp(name, email, password) {
  console.log('[auth.js] creating auth account...');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  console.log('[auth.js] auth account created, uid:', cred.user.uid);
  if (name) {
    console.log('[auth.js] setting display name...');
    await updateProfile(cred.user, { displayName: name });
    console.log('[auth.js] display name set');
  }
  console.log('[auth.js] syncing profile to Firestore/RTDB...');
  await saveUserRecord(cred.user, { name, isNew: true });
  console.log('[auth.js] signUp complete');
  return cred.user;
}

export async function logIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  // Second verification step: confirm a matching RTDB profile exists.
  // Self-heal common case: auth account exists but profile records
  // are missing (e.g. user was created before this system existed).
  const record = await verifyAgainstRtdb(cred.user);
  if (!record) {
    await saveUserRecord(cred.user, { isNew: true });
  } else {
    // Just stamp last-login time; failures here are non-fatal.
    try {
      await withTimeout(
        Promise.all([
          setDoc(
            doc(db, "users", cred.user.uid),
            { lastLoginAt: fsServerTimestamp() },
            { merge: true }
          ),
          update(ref(rtdb, "users/" + cred.user.uid), {
            lastLoginAt: rtdbServerTimestamp()
          })
        ]),
        6000,
        "Last-login update"
      );
    } catch (err) {
      console.warn("[auth] last-login timestamp update failed or timed out:", err);
    }
  }

  return cred.user;
}

export async function logOut() {
  await signOut(auth);
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function googleSignIn() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);

  // Create the profile the first time we see this user.
  let existing = null;
  try {
    existing = await withTimeout(getDoc(doc(db, "users", cred.user.uid)), 6000, "Profile check");
  } catch (err) {
    console.warn("[auth] could not check existing profile:", err);
  }
  await saveUserRecord(cred.user, { isNew: !(existing && existing.exists()) });

  return cred.user;
}

/* ------------------------------------------------------------------ */
/* Auth state subscription                                             */
/* ------------------------------------------------------------------ */

// Subscribes to Firebase's own auth state. Fires immediately on:
//  - page load (restores an existing session, if any)
//  - successful sign-in / sign-up
//  - sign-out
// This is the single source of truth pages should use to update their
// UI — it does NOT depend on the Firestore/RTDB profile writes above,
// so it can't get stuck if those are slow or rules-blocked.
export function initAuthUI(callback) {
  return onAuthStateChanged(auth, (user) => {
    if (typeof callback === "function") {
      callback(user);
    }
  });
}
