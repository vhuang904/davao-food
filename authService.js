// authService.js - 大V的旅遊窩 PWA 認證模組（Google + Email 魔法精靈雙軌互通版）

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
  signInWithEmailLink,
  fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs,
  query,
  where,
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

export function isMobileOrStandalone() {
  const isStandaloneMatch = window.matchMedia("(display-mode: standalone)").matches;
  const isNavigatorStandalone = window.navigator.standalone === true;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return isStandaloneMatch || isNavigatorStandalone || isMobile;
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

// 核心：雙軌互通會員資料庫讀取（以 Email 跨 UID 繼承積分）
export async function fetchOrCreateUserProfile(user) {
  if (!user) {
    currentUserProfile = null;
    broadcastAuthChange(null, null);
    return null;
  }

  const userEmail = (user.email || "").toLowerCase().trim();
  const userRef = doc(db, "users", user.uid);

  try {
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      currentUserProfile = {
        uid: user.uid,
        displayName: data.displayName || user.displayName || "吃貨食客",
        photoURL: data.photoURL || user.photoURL || "",
        email: userEmail,
        points: typeof data.points === "number" ? data.points : 50,
        level: data.level || calculateUserLevel(data.points || 50)
      };
    } else {
      // 雙軌繼承機制：檢查此 Email 是否之前用另一種方式登入並已有積分
      let inheritedPoints = 50;
      let inheritedLevel = "LV.1 探店初心者";

      if (userEmail) {
        try {
          const emailQuery = query(collection(db, "users"), where("email", "==", userEmail));
          const querySnap = await getDocs(emailQuery);
          if (!querySnap.empty) {
            // 找到舊紀錄，無縫繼承既有積分
            const oldData = querySnap.docs[0].data();
            inheritedPoints = oldData.points || 50;
            inheritedLevel = oldData.level || calculateUserLevel(inheritedPoints);
            console.log(`[AuthService] 雙軌資料自動合併：已從歷史帳號繼承 ${inheritedPoints} 積分！`);
          }
        } catch (queryErr) {
          console.warn("[AuthService] 檢查歷史帳號略過:", queryErr);
        }
      }

      const newProfile = {
        displayName: user.displayName || "吃貨食客",
        photoURL: user.photoURL || "",
        email: userEmail,
        points: inheritedPoints,
        level: inheritedLevel,
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
      email: userEmail,
      points: 50,
      level: "LV.1 探店初心者"
    };
    broadcastAuthChange(user, currentUserProfile);
    return currentUserProfile;
  }
}

// 1. Google 登入（Popup 優先相容手機與桌面，遇彈窗阻擋自動退回 Redirect）
export async function loginWithGoogle() {
  try {
    // 優先使用彈窗模式，避免 iOS/Android 跨網域 Cookie 被丟失
    const result = await signInWithPopup(auth, googleProvider);
    return await fetchOrCreateUserProfile(result.user);
  } catch (error) {
    console.warn("[AuthService] Popup 登入回傳或被攔截:", error.code, error.message);

    // 只有在瀏覽器嚴格封鎖彈窗或獨立 PWA 模式時，才退回 Redirect
    if (
      error.code === 'auth/popup-blocked' || 
      error.code === 'auth/cancelled-popup-request' ||
      isPwaStandalone()
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    
    // 若為使用者自行點 X 關閉視窗，拋出友善提示
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error("已取消 Google 登入。");
    }

    throw error;
  }
}

// 2. Email 魔法精靈登入（直接向 Firestore 驗證是否已是 Google 用戶）
export async function sendMagicEmailLink(email) {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("請輸入正確的電子郵件信箱。");
  }

  // 直接向 Firestore users 集合查詢該信箱是否已註冊過
  try {
    const emailQuery = query(collection(db, "users"), where("email", "==", cleanEmail));
    const querySnap = await getDocs(emailQuery);

    if (!querySnap.empty) {
      // 只要先前已經用 Google 登入並建立了資料庫檔案，直接阻擋並引導！
      throw new Error("此信箱已註冊過！請直接點擊上方「使用 Google 帳號一鍵登入」。");
    }
  } catch (err) {
    if (err.message && err.message.includes("Google")) {
      throw err;
    }
    console.warn("[AuthService] 檢查歷史用戶略過:", err);
  }

  const actionCodeSettings = {
    url: window.location.origin + window.location.pathname,
    handleCodeInApp: true
  };

  await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);
  window.localStorage.setItem("emailForSignIn", cleanEmail);
  return true;
}

// 3. 登出
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

// 4. 發表評論累計積分
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

// 5. 初始化認證監聽（支援重定向與魔法連結自動完成）
export function initAuthService() {
  // 檢查 Email 魔法連結跳回
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem("emailForSignIn");
    if (!email) {
      email = window.prompt("請輸入登入時所使用的電子郵件信箱：");
    }
    if (email) {
      signInWithEmailLink(auth, email, window.location.href)
        .then(async (result) => {
          window.localStorage.removeItem("emailForSignIn");
          await fetchOrCreateUserProfile(result.user);
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => console.error("[AuthService] Email 魔法登入驗證錯誤:", err));
    }
  }

  // 檢查 Google Redirect 跳回
  getRedirectResult(auth)
    .then(async (result) => {
      if (result && result.user) {
        await fetchOrCreateUserProfile(result.user);
      }
    })
    .catch((error) => {
      console.error("[AuthService] Redirect 解析失敗:", error.code, error.message);
    });

  // 全域監聽狀態
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await fetchOrCreateUserProfile(user);
    } else {
      currentUserProfile = null;
      broadcastAuthChange(null, null);
    }
  });
}
