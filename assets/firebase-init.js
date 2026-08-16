// assets/firebase-init.js
// Central Firebase initialization. Import this (as a module) on any page
// that needs Auth / Firestore / Realtime Database.
//
// IMPORTANT: This file must be loaded as an ES module:
//   <script type="module" src="assets/firebase-init.js"></script>
// and the site must be served over http(s) (e.g. `firebase serve`,
// `firebase hosting:channel:deploy`, or any local dev server).
// Opening the HTML file directly as file:// will NOT work because
// browsers block ES module + CORS requests on the file protocol.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgmOaMvej86EuZeUmVGotYuCuII6kNQZI",
  authDomain: "pycode-51450.firebaseapp.com",
  projectId: "pycode-51450",
  storageBucket: "pycode-51450.firebasestorage.app",
  messagingSenderId: "500087801800",
  appId: "1:500087801800:web:efa1a340c222551ed862fd",
  // Realtime Database needs its own URL. Update this if your RTDB
  // instance URL is different (check Firebase console > Realtime Database).
  databaseURL: "https://pycode-51450-default-rtdb.asia-southeast1.firebasedatabase.app"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);       // Firestore
export const rtdb = getDatabase(app);      // Realtime Database
