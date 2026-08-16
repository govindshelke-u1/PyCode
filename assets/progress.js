// assets/progress.js
// Tracks per-module quiz scores in Firestore and computes overall
// points + completion percentage for display on index.html.
//
// Data shape on users/{uid}:
//   scores:           { module1: 4, module2: 5, ... }   (points earned, out of MAX_POINTS_PER_MODULE)
//   completedModules: { module1: true, module2: true }  (marks a module as attempted/finished)
//
// Update this list as new modules are published.
export const MODULE_IDS = ["module1", "module2", "module3"];
export const MAX_POINTS_PER_MODULE = 5; // 5 MCQs per test, 1 point each

import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Call this from a Test-ModuleX page when the user finishes the quiz.
// Safe to call even if Firestore is briefly unreachable — it just warns.
export async function saveModuleScore(db, uid, moduleId, score) {
  if (!uid) return;
  try {
    await setDoc(
      doc(db, "users", uid),
      {
        [`scores.${moduleId}`]: score,
        [`completedModules.${moduleId}`]: true
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[progress] failed to save module score:", err);
  }
}

// Reads a user's progress and returns a summary for display.
export async function getUserProgress(db, uid) {
  const empty = {
    totalPoints: 0,
    maxPoints: MODULE_IDS.length * MAX_POINTS_PER_MODULE,
    completedCount: 0,
    totalModules: MODULE_IDS.length,
    percent: 0,
    scores: {}
  };
  if (!uid) return empty;

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return empty;

    const data = snap.data();
    const scores = data.scores || {};
    const completed = data.completedModules || {};

    let totalPoints = 0;
    let completedCount = 0;
    MODULE_IDS.forEach((id) => {
      if (typeof scores[id] === "number") totalPoints += scores[id];
      if (completed[id]) completedCount++;
    });

    const maxPoints = MODULE_IDS.length * MAX_POINTS_PER_MODULE;
    const percent = MODULE_IDS.length
      ? Math.round((completedCount / MODULE_IDS.length) * 100)
      : 0;

    return {
      totalPoints,
      maxPoints,
      completedCount,
      totalModules: MODULE_IDS.length,
      percent,
      scores
    };
  } catch (err) {
    console.warn("[progress] failed to load progress:", err);
    return empty;
  }
}
