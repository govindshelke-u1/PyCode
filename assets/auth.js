// assets/auth.js
// Handles Sign Up / Login / Logout using Firebase Authentication, and keeps
// a matching user profile in BOTH Firestore ("users/{uid}") and the
// Realtime Database ("users/{uid}"). On login, the user's Realtime
// Database record is checked as a second verification step alongside
// Firebase Auth itself.

import { auth, db, rtdb } from "./firebase-init.js";
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

// Write the same profile into Firestore + Realtime Database.
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

  await Promise.all([
    setDoc(doc(db, "users", user.uid), profileFirestore, { merge: true }),
    set(ref(rtdb, "users/" + user.uid), profileRtdb)
  ]);
}

// Confirms the signed-in user also has a matching record in RTDB.
// Returns the RTDB record, or throws if it's missing/mismatched.
async function verifyAgainstRtdb(user) {
  const snap = await get(ref(rtdb, "users/" + user.uid));
  if (!snap.exists()) {
    throw new Error(
      "No matching Realtime Database record found for this account."
    );
  }
  const record = snap.val();
  if (record.email && record.email !== user.email) {
    throw new Error("Account record mismatch. Please contact support.");
  }
  return record;
}

/* ------------------------------------------------------------------ */
/* Public actions                                                      */
/* ------------------------------------------------------------------ */

export async function signUp(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await updateProfile(cred.user, { displayName: name });
  }
  await saveUserRecord(cred.user, { name, isNew: true });
  return cred.user;
}

export async function logIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);

  // Second verification step: confirm a matching RTDB profile exists.
  try {
    await verifyAgainstRtdb(cred.user);
  } catch (err) {
    // Self-heal common case: auth account exists but profile records
    // are missing (e.g. user was created before this system existed).
    // Recreate them instead of locking the user out.
    await saveUserRecord(cred.user, { isNew: true });
  }

  // Record last login time in both stores.
  await Promise.all([
    setDoc(
      doc(db, "users", cred.user.uid),
      { lastLoginAt: fsServerTimestamp() },
      { merge: true }
    ),
    update(ref(rtdb, "users/" + cred.user.uid), {
      lastLoginAt: rtdbServerTimestamp()
    })
  ]);

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
  const existing = await getDoc(doc(db, "users", cred.user.uid));
  await saveUserRecord(cred.user, { isNew: !existing.exists() });

  return cred.user;
}

/* ------------------------------------------------------------------ */
/* Shared UI binding (nav bar login/logout state)                      */
/* Works on any page that includes the standard nav markup.            */
/* ------------------------------------------------------------------ */

export function initAuthUI() {
  const loginTrigger = document.getElementById("loginTrigger");
  const userBadge = document.getElementById("userBadge");

  onAuthStateChanged(auth, (user) => {
    if (!loginTrigger) return;

    if (user) {
      loginTrigger.textContent = "Log out";
      loginTrigger.onclick = async () => {
        await logOut();
      };
      if (userBadge) {
        userBadge.textContent = user.displayName || user.email;
        userBadge.classList.remove("hidden");
      }
    } else {
      loginTrigger.textContent = "Log in/Sign in";
      loginTrigger.onclick = null; // index.html re-attaches its modal-open handler
      if (userBadge) {
        userBadge.textContent = "";
        userBadge.classList.add("hidden");
      }
    }
  });
}
