// authService.js - 大V的旅遊窩 PWA 獨立認證模組（整合 Google 雙軌 + Email 魔法登入 + 狀態持久化）

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signOut, 
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
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

let currentUserProfile = null;

export function calculateUserLevel(points = 0) {
  if (points >= 500) return "LV.5 終極米其林老饕";
  if (points >= 300) return "LV.4 尋味美食家";
  if (points >= 150) return "LV.3 街巷老吃貨";
  if (points >= 50) return "LV.2 認證探店客";
  return "LV.1 探店初心者";
}

export function isPwaStandalone() {
  const isStandaloneMatch = window.matchMedia("(display-mode: standalone)").matches;
  const isNavigatorStandalone = window.navigator.standalone === true;
  return isStandaloneMatch || isNavigatorStandalone;
}

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

export async function fetchOrCreateUserProfile(user) {
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

// 1. Google 一鍵登入
export async function loginWithGoogle() {
  try {
    if (isPwaStandalone()) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    } else {
      const result = await signInWithPopup(auth, googleProvider);
      return await fetchOrCreateUserProfile(result.user);
    }
  } catch (error) {
    console.warn("[AuthService] 彈窗登入失敗，降級為 Redirect:", error);
    await signInWithRedirect(auth, googleProvider);
    return null;
  }
}

// 2. Email 魔法精靈：寄送免密碼驗證信
export async function sendMagicEmailLink(email) {
  const cleanEmail = (email || "").trim();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("請輸入正確的電子郵件信箱。");
  }

  const actionCodeSettings = {
    url: window.location.origin + window.location.pathname,
    handleCodeInApp: true
  };

  await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);
  window.localStorage.setItem("emailForSignIn", cleanEmail);
  return true;
}

// 3. 核心功能：登出
export async function logoutUser() {
  try {
    await signOut(auth);
    currentUserProfile = null;
    window.localStorage.removeItem("emailForSignIn");
    broadcastAuthChange(null, null);
  } catch (error) {
    console.error("[AuthService] 登出失敗:", error);
    throw error;
  }
}

export function getCurrentProfile() {
  return currentUserProfile;
}

export async function addStoreComment(storeId, commentPayload) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("請先登入後再發表探店評價。");
  }

  if (!storeId) {
    throw new Error("店家代碼無效。");
  }

  const cleanComment = (commentPayload.comment || "").trim();
  if (!cleanComment) {
    throw new Error("請填寫評價內容。");
  }

  const rating = Number(commentPayload.rating) || 5;

  const commentDocData = {
    storeId: String(storeId),
    targetId: String(storeId),
    userId: currentUser.uid,
    userName: currentUserProfile?.displayName || currentUser.displayName || "匿名老饕",
    userPhoto: currentUserProfile?.photoURL || currentUser.photoURL || "",
    rating: rating,
    comment: cleanComment,
    content: cleanComment,
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, "comments"), commentDocData);

  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    points: increment(20),
    lastCommentAt: serverTimestamp()
  });

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

// 4. 初始化認證監聽器（處理跳轉回調與 Email 魔法登入驗證）
export function initAuthService() {
  // A. 處理 Email 魔法連結跳回
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem("emailForSignIn");
    if (!email) {
      email = window.prompt("請再次確認您登入時使用的電子郵件信箱：");
    }
    if (email) {
      signInWithEmailLink(auth, email, window.location.href)
        .then(async (result) => {
          window.localStorage.removeItem("emailForSignIn");
          await fetchOrCreateUserProfile(result.user);
          // 清理 URL 上的授權參數
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => console.error("[AuthService] Email 魔法登入失敗:", err));
    }
  }

  // B. 處理 Google Redirect 重定向跳回
  getRedirectResult(auth)
    .then(async (result) => {
      if (result && result.user) {
        await fetchOrCreateUserProfile(result.user);
      }
    })
    .catch((error) => {
      console.error("[AuthService] Google Redirect 回調錯誤:", error);
    });

  // C. 持續監聽狀態
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await fetchOrCreateUserProfile(user);
    } else {
      currentUserProfile = null;
      broadcastAuthChange(null, null);
    }
  });
}
