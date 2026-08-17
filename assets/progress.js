// assets/progress.js
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const MODULE_IDS = ["module1", "module2", "module3", "module4", "module5", "module6", "module7"];
export const MAX_POINTS_PER_MODULE = 5; // 5 points per module test
export const TOTAL_MODULES = MODULE_IDS.length;
export const MAX_POINTS = TOTAL_MODULES * MAX_POINTS_PER_MODULE; // 35 pts total

// Save Module Test Score to Firestore & localStorage
export async function saveModuleScore(db, uid, moduleId, score) {
  if (!uid || !moduleId) return;

  // 1. Local backup
  const localScores = JSON.parse(localStorage.getItem('pycode_scores') || '{}');
  localScores[moduleId] = Math.max(localScores[moduleId] || 0, score);
  localStorage.setItem('pycode_scores', JSON.stringify(localScores));

  // 2. Write to Firestore
  try {
    await setDoc(
      doc(db, "users", uid),
      {
        [`scores.${moduleId}`]: score,
        [`completedModules.${moduleId}`]: true,
        lastActiveAt: serverTimestamp()
      },
      { merge: true }
    );
    console.log(`[progress] Saved ${moduleId} score (${score}/${MAX_POINTS_PER_MODULE}) for user ${uid}`);
  } catch (err) {
    console.warn("[progress] Failed to save module score to Firestore:", err);
  }
}

// Fetch complete progress summary
export async function getUserProgress(db, uid) {
  const empty = {
    totalPoints: 0,
    maxPoints: MAX_POINTS,
    completedCount: 0,
    totalModules: TOTAL_MODULES,
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
      if (typeof scores[id] === "number") {
        totalPoints += scores[id];
      }
      if (completed[id] === true) {
        completedCount++;
      }
    });

    const percent = Math.min(100, Math.round((totalPoints / MAX_POINTS) * 100));

    return {
      totalPoints,
      maxPoints: MAX_POINTS,
      completedCount,
      totalModules: TOTAL_MODULES,
      percent,
      scores
    };
  } catch (err) {
    console.warn("[progress] Failed to load progress:", err);
    return empty;
  }
}
