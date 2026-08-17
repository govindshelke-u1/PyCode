// assets/progress.js
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const MODULE_IDS = ["module1", "module2", "module3", "module4", "module5", "module6", "module7"];
export const LESSONS_PER_MODULE = 4;
export const TOTAL_LESSONS = MODULE_IDS.length * LESSONS_PER_MODULE; // 28 total lessons
export const POINTS_PER_LESSON = 10;
export const MAX_POINTS = TOTAL_LESSONS * POINTS_PER_LESSON; // 280 pts total

// Mark an individual lesson as completed and persist to Firestore + localStorage
export async function markLessonComplete(db, uid, lessonId) {
  if (!uid || !lessonId) return;

  // 1. Instant local persistence for fast UI rendering
  const localCompleted = JSON.parse(localStorage.getItem('pycode_completed_lessons') || '{}');
  localCompleted[lessonId] = true;
  localStorage.setItem('pycode_completed_lessons', JSON.stringify(localCompleted));

  // 2. Persist to Firestore
  try {
    await setDoc(
      doc(db, "users", uid),
      {
        [`completedLessons.${lessonId}`]: true,
        lastActiveAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[progress] failed to save lesson completion:", err);
  }
}

// Computes user points, completed lesson count, and percentage
export async function getUserProgress(db, uid) {
  const empty = {
    totalPoints: 0,
    maxPoints: MAX_POINTS,
    completedLessonsCount: 0,
    totalLessons: TOTAL_LESSONS,
    percent: 0,
    completedLessons: {}
  };
  if (!uid) return empty;

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return empty;

    const data = snap.data();
    const completedLessons = data.completedLessons || {};

    const completedLessonsCount = Object.keys(completedLessons).filter(
      (key) => completedLessons[key] === true
    ).length;

    const totalPoints = completedLessonsCount * POINTS_PER_LESSON;
    const percent = Math.min(100, Math.round((completedLessonsCount / TOTAL_LESSONS) * 100));

    return {
      totalPoints,
      maxPoints: MAX_POINTS,
      completedLessonsCount,
      totalLessons: TOTAL_LESSONS,
      percent,
      completedLessons
    };
  } catch (err) {
    console.warn("[progress] failed to load user progress:", err);
    return empty;
  }
}
