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

// Mark a single lesson page as completed (called from lesson pages, not tests)
export async function markLessonComplete(db, uid, lessonId) {
  if (!uid || !lessonId) return;
  console.log(`[progress] marking lesson complete: ${lessonId} for uid ${uid}`);
  try {
    await setDoc(
      doc(db, "users", uid),
      {
        [`completedLessons.${lessonId}`]: true,
        lastActiveAt: serverTimestamp()
      },
      { merge: true }
    );
    console.log(`[progress] lesson ${lessonId} saved successfully`);
  } catch (err) {
    console.error(`[progress] FAILED to save lesson ${lessonId}:`, err);
  }
}

// The full course in order: lessons, then that module's test, repeated.
// Add new rows here as you publish more modules.
export const LESSON_SEQUENCE = [
  { id: "m01_l01", url: "Module1/M01-L01.html", label: "Module 1 · Lesson 1", type: "lesson" },
  { id: "m01_l02", url: "Module1/M01-L02.html", label: "Module 1 · Lesson 2", type: "lesson" },
  { id: "m01_l03", url: "Module1/M01-L03.html", label: "Module 1 · Lesson 3", type: "lesson" },
  { id: "m01_l04", url: "Module1/M01-L04.html", label: "Module 1 · Lesson 4", type: "lesson" },
  { id: "module1_test", url: "Module1/Test-Module1.html", label: "Module 1 · Test", type: "test", moduleId: "module1" },

  { id: "m02_l01", url: "Module2/M02-L01.html", label: "Module 2 · Lesson 1", type: "lesson" },
  { id: "m02_l02", url: "Module2/M02-L02.html", label: "Module 2 · Lesson 2", type: "lesson" },
  { id: "m02_l03", url: "Module2/M02-L03.html", label: "Module 2 · Lesson 3", type: "lesson" },
  { id: "module2_test", url: "Module2/Test-Module2.html", label: "Module 2 · Test", type: "test", moduleId: "module2" },

  { id: "m03_l01", url: "Module3/M03-L01.html", label: "Module 3 · Lesson 1", type: "lesson" },
  { id: "m03_l02", url: "Module3/M03-L02.html", label: "Module 3 · Lesson 2", type: "lesson" },
  { id: "m03_l03", url: "Module3/M03-L03.html", label: "Module 3 · Lesson 3", type: "lesson" },
  { id: "m03_l04", url: "Module3/M03-L04.html", label: "Module 3 · Lesson 4", type: "lesson" },
  { id: "module3_test", url: "Module3/Test-Module3.html", label: "Module 3 · Test", type: "test", moduleId: "module3" }
];

// Returns the next lesson/test the user hasn't finished yet, or null if
// they've completed the whole sequence. Called from index.html.
export async function getNextLesson(db, uid) {
  if (!uid) return LESSON_SEQUENCE[0];
  try {
    const snap = await getDoc(doc(db, "users", uid));
    console.log('[progress] user doc exists:', snap.exists());
    const data = snap.exists() ? snap.data() : {};
    console.log('[progress] full user doc data:', data);
    const completedLessons = data.completedLessons || {};
    const completedModules = data.completedModules || {};
    console.log('[progress] completedLessons:', completedLessons);
    console.log('[progress] completedModules:', completedModules);

    for (const item of LESSON_SEQUENCE) {
      const done = item.type === "test"
        ? completedModules[item.moduleId] === true
        : completedLessons[item.id] === true;
      console.log(`[progress] checking ${item.id} (${item.type}) -> done: ${done}`);
      if (!done) {
        console.log('[progress] next incomplete item:', item.id);
        return item;
      }
    }
    console.log('[progress] everything complete!');
    return null; // finished everything
  } catch (err) {
    console.error("[progress] FAILED to compute next lesson:", err);
    return LESSON_SEQUENCE[0];
  }
}
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
