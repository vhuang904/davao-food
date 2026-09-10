// authService.js - 大V的旅遊窩 PWA 獨立認證與會員積分服務模組
// 遵循 100% 全量無省略規範，支援 PWA Standalone 雙軌登入與 Firestore 積分原子回填

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  serverTimestamp, 
  increment 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Firebase 初始化（填入真實 Key）
const firebaseConfig = {
  apiKey: "AIzaSyCm2dCa2Y8d6Z-Dc_Uz9yvvgai6fav-1Vg",
  authDomain: "bigv-foodmap.firebaseapp.com",
  projectId: "bigv-foodmap",
  storageBucket: "bigv-foodmap.firebasestorage.app",
  messagingSenderId: "701000455421",
  appId: "1:701000455421:web:ab02befef466e1f8989a94",
  measurementId: "G-9G6BR6ZGBP"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// 2. 當前本地快取的用戶狀態
let currentUserProfile = null;

// 計算吃貨等級演算法
export function calculateUserLevel(points = 0) {
  if (points >= 500) return "LV.5 終極米其林老饕";
  if (points >= 300) return "LV.4 尋味美食家";
  if (points >= 150) return "LV.3 街巷老吃貨";
  if (points >= 50) return "LV.2 認證探店客";
  return "LV.1 探店初心者";
}

// 判斷是否為手機 PWA Standalone 獨立視窗環境
export function isPwaStandalone() {
  const isStandaloneMatch = window.matchMedia("(display-mode: standalone)").matches;
  const isNavigatorStandalone = window.navigator.standalone === true;
  return isStandaloneMatch || isNavigatorStandalone;
}

// 廣播全域認證狀態變更事件
function broadcastAuthChange(user, profile) {
  const event = new CustomEvent("auth-user-changed", {
    detail: {
      user: user,
      profile: profile,
      isLoggedIn: !!user
    }
  });
  window.dispatchEvent(event);
}

// 取得或初始化 Firestore 使用者資料
async function fetchOrCreateUserProfile(user) {
  if (!user) {
    currentUserProfile = null;
    broadcastAuthChange(null, null);
    return null;
  }

  const userRef = doc(db, "users", user.uid);
  try {
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      currentUserProfile = {
        uid: user.uid,
        displayName: data.displayName || user.displayName || "吃貨食客",
        photoURL: data.photoURL || user.photoURL || "",
        email: data.email || user.email || "",
        points: typeof data.points === "number" ? data.points : 50,
        level: data.level || calculateUserLevel(data.points || 50)
      };
    } else {
      // 新會員註冊預設贈送 50 積分
      const initialPoints = 50;
      const initialLevel = calculateUserLevel(initialPoints);
      const newProfile = {
        displayName: user.displayName || "吃貨食客",
        photoURL: user.photoURL || "",
        email: user.email || "",
        points: initialPoints,
        level: initialLevel,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      };
      await setDoc(userRef, newProfile, { merge: true });
      currentUserProfile = {
        uid: user.uid,
        ...newProfile
      };
    }
    broadcastAuthChange(user, currentUserProfile);
    return currentUserProfile;
  } catch (error) {
    console.error("[AuthService] 讀取/建立會員資料失敗:", error);
    currentUserProfile = {
      uid: user.uid,
      displayName: user.displayName || "吃貨食客",
      photoURL: user.photoURL || "",
      email: user.email || "",
      points: 50,
      level: "LV.1 探店初心者"
    };
    broadcastAuthChange(user, currentUserProfile);
    return currentUserProfile;
  }
}

// 3. 核心功能：登入（支援 PWA 雙軌機制）
export async function loginWithGoogle() {
  try {
    if (isPwaStandalone()) {
      // 手機 PWA 獨立視窗模式：使用 Redirect 避免彈窗被系統阻擋
      await signInWithRedirect(auth, googleProvider);
      return null;
    } else {
      // 一般瀏覽器模式：使用 Popup 彈窗提供流暢不跳頁體驗
      const result = await signInWithPopup(auth, googleProvider);
      return await fetchOrCreateUserProfile(result.user);
    }
  } catch (error) {
    console.warn("[AuthService] 彈窗登入失敗，嘗試降級改為 Redirect 重定向登入:", error);
    try {
      await signInWithRedirect(auth, googleProvider);
      return null;
    } catch (redirectError) {
      console.error("[AuthService] 重定向登入亦失敗:", redirectError);
      throw redirectError;
    }
  }
}

// 4. 核心功能：登出
export async function logoutUser() {
  try {
    await signOut(auth);
    currentUserProfile = null;
    broadcastAuthChange(null, null);
  } catch (error) {
    console.error("[AuthService] 登出失敗:", error);
    throw error;
  }
}

// 5. 核心功能：取得目前用戶設定檔
export function getCurrentProfile() {
  return currentUserProfile;
}

// 6. 核心功能：發表店家評論並自動累加 20 積分
export async function addStoreComment(storeId, commentPayload) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("請先登入後再發表探店評價。");
  }

  if (!storeId) {
    throw new Error("店家代碼（storeId）無效。");
  }

  const cleanComment = (commentPayload.comment || "").trim();
  if (!cleanComment) {
    throw new Error("請填寫評價內容。");
  }

  const rating = Number(commentPayload.rating) || 5;

  // 寫入 comments 集合
  const commentDocData = {
    storeId: String(storeId),
    userId: currentUser.uid,
    userName: currentUserProfile?.displayName || currentUser.displayName || "匿名老饕",
    userPhoto: currentUserProfile?.photoURL || currentUser.photoURL || "",
    rating: rating,
    comment: cleanComment,
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, "comments"), commentDocData);

  // 寫入 users 集合：積分原子化累加 +20
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    points: increment(20),
    lastCommentAt: serverTimestamp()
  });

  // 本地快取立即同步更新（Optimistic UI）
  if (currentUserProfile) {
    currentUserProfile.points = (currentUserProfile.points || 0) + 20;
    currentUserProfile.level = calculateUserLevel(currentUserProfile.points);
    await updateDoc(userRef, { level: currentUserProfile.level });
    broadcastAuthChange(currentUser, currentUserProfile);
  }

  return {
    success: true,
    addedPoints: 20,
    newPoints: currentUserProfile?.points,
    newLevel: currentUserProfile?.level
  };
}

// 7. 初始化服務監聽器
export function initAuthService() {
  // 檢查是否為 PWA 重定向登入後回調
  getRedirectResult(auth)
    .then(async (result) => {
      if (result && result.user) {
        await fetchOrCreateUserProfile(result.user);
      }
    })
    .catch((error) => {
      console.error("[AuthService] Redirect 回調錯誤:", error);
    });

  // 全域監聽使用者登入/登出狀態
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await fetchOrCreateUserProfile(user);
    } else {
      currentUserProfile = null;
      broadcastAuthChange(null, null);
    }
  });
}
