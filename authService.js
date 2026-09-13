// authService.js - 大V的旅遊窩 PWA 認證模組（全平台跨網域防阻擋高相容版）

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
  setPersistence,
  browserLocalPersistence
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

// 設定登入狀態本機持久化
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("[AuthService] 設定持久化略過:", err);
});

const googleProvider = new GoogleAuthProvider();
// ⭐ 拿掉 prompt: 'select_account'，讓瀏覽器記住上次選取的帳號，實現真正的一鍵靜默授權
googleProvider.setCustomParameters({});

let currentUserProfile = null;

export function calculateUserLevel(points = 0) {
  if (points >= 500) return "LV.5 終極米其林老饕";
  if (points >= 300) return "LV.4 尋味美食家";
  if (points >= 150) return "LV.3 街巷老吃貨";
  if (points >= 50) return "LV.2 認證探店客";
  return "LV.1 探店初心者";
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

// 核心：雙軌互通會員資料庫讀取與同步
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
      let inheritedPoints = 50;
      let inheritedLevel = "LV.1 探店初心者";

      if (userEmail) {
        try {
          const emailQuery = query(collection(db, "users"), where("email", "==", userEmail));
          const querySnap = await getDocs(emailQuery);
          if (!querySnap.empty) {
            const oldData = querySnap.docs[0].data();
            inheritedPoints = oldData.points || 50;
            inheritedLevel = oldData.level || calculateUserLevel(inheritedPoints);
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

// 1. Google 登入（⭐ 全平台一律彈窗優先，徹底避開 iOS Safari / Chrome 跨網域跳轉丟失 Token 死鎖）
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result && result.user) {
      const profile = await fetchOrCreateUserProfile(result.user);
      return profile;
    }
    return null;
  } catch (error) {
    console.warn("[AuthService] Google Popup 登入異常:", error.code, error.message);

    // 若瀏覽器彈窗被硬性攔截，才進行轉址降級
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
      console.log("[AuthService] 彈窗受阻，切換至轉址模式備援...");
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error("您已關閉登入視窗。");
    }

    throw error;
  }
}

// 2. Email 魔法精靈登入
export async function sendMagicEmailLink(email) {
  const cleanEmail = (email || "").trim().toLowerCase();
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

// 4. 發表評論累計積分 (+20 PTS)
export async function addStoreComment(storeId, commentPayload) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("請先登入後再發表探店評價。");
  }

  if (!storeId) {
    throw new Error("店家代碼無效。");
  }

  const cleanComment = (typeof commentPayload === 'string' ? commentPayload : (commentPayload?.comment || "")).trim();
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

// 4-1. 讀取店家雲端真實評論
export async function getStoreComments(storeId) {
  if (!storeId) return [];
  try {
    const q = query(
      collection(db, "comments"),
      where("storeId", "==", String(storeId))
    );
    const snap = await getDocs(q);
    const comments = [];
    snap.forEach((d) => {
      comments.push({ id: d.id, ...d.data() });
    });
    return comments.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
  } catch (err) {
    console.warn("[AuthService] 讀取評論異常:", err);
    return [];
  }
}

// 5. 初始化認證監聽（支援魔法連結驗證、轉址回傳相容與全域狀態）
export function initAuthService() {
  // A. 檢查 Email 魔法連結跳回
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

  // B. 檢查 Google Redirect 跳回（若有先前殘留的跳轉仍可被解析）
  getRedirectResult(auth)
    .then(async (result) => {
      if (result && result.user) {
        await fetchOrCreateUserProfile(result.user);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    })
    .catch((error) => {
      console.warn("[AuthService] Redirect 狀態略過:", error.code);
    });

  // C. 全域監聽狀態（持久化登入保持）
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await fetchOrCreateUserProfile(user);
    } else {
      currentUserProfile = null;
      broadcastAuthChange(null, null);
    }
  });
}
