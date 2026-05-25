import { useState, useEffect } from "react";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc
} from "firebase/firestore";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { app, db } from "./firebase";
import "./App.css";

const auth = getAuth(app);

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [folders, setFolders] = useState([]);
  const [activeFolderId, setActiveFolderId] = useState(null);
  
  // Custom interactive states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Handle auto-authentication monitoring
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        showToast("Oturum Açık", `${currentUser.email} olarak giriş yapıldı.`, "info");
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch educational folders and video playlists
  useEffect(() => {
    const getFolders = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "folders"));
        const folderList = [];
        querySnapshot.forEach((docItem) => {
          folderList.push({
            id: docItem.id,
            ...docItem.data(),
          });
        });
        setFolders(folderList);
        
        // Auto-select the first folder if available
        if (folderList.length > 0) {
          setActiveFolderId(folderList[0].id);
        }
      } catch (err) {
        showToast("Veri Yükleme Hatası", "Klasörler yüklenirken bir sorun oluştu.", "error");
      }
    };

    getFolders();
  }, []);

  // Custom Toast notification generator
  const showToast = (title, message, type = "info") => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type, hiding: false }]);

    // Slide out animation
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, hiding: true } : t))
      );
    }, 4000);

    // Remove from state
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4300);
  };

  const removeToast = (id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, hiding: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  };

  // Secure Multi-device login logic
  const login = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      showToast("Giriş Hatası", "Lütfen tüm alanları doldurun.", "error");
      return;
    }

    setIsLoggingIn(true);
    try {
      // 1. Get unique device fingerprint
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      const deviceId = result.visitorId;

      // 2. Perform Firebase Auth Login
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // 3. Check device assignment in Firestore
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      // Register first device
      if (!userSnap.exists()) {
        await setDoc(userRef, { deviceId: deviceId });
        showToast("Cihaz Kaydedildi", "Bu cihaz hesabınız için başarıyla kaydedildi.", "success");
        setIsLoggingIn(false);
        return;
      }

      const userData = userSnap.data();

      // Block multi-device login sharing
      if (userData.deviceId !== deviceId) {
        await signOut(auth);
        showToast("Giriş Engellendi", "Bu hesap başka bir cihazda kullanılmaktadır.", "error");
        setIsLoggingIn(false);
        return;
      }

      showToast("Giriş Başarılı", "Hesabınıza başarıyla giriş yaptınız.", "success");
    } catch (err) {
      let friendlyMessage = err.message;
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        friendlyMessage = "E-posta adresi veya şifre hatalı.";
      }
      showToast("Hata Oluştu", friendlyMessage, "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast("Çıkış Yapıldı", "Oturumunuz başarıyla sonlandırıldı.", "success");
      setActiveFolderId(null);
    } catch (err) {
      showToast("Hata", "Çıkış yapılırken bir hata oluştu.", "error");
    }
  };

  const handleFullscreen = (index) => {
    const container = document.getElementById(`player-container-${index}`);
    if (container) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
    }
  };

  const getActiveFolder = () => {
    return folders.find((f) => f.id === activeFolderId) || null;
  };

  const activeFolder = getActiveFolder();

  return (
    <>
      {/* Toast Notification Mount */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type} ${toast.hiding ? "hiding" : ""}`}
          >
            <div className="toast-icon">
              {toast.type === "success" && "✓"}
              {toast.type === "error" && "⚠"}
              {toast.type === "info" && "ℹ"}
            </div>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>

      {!user ? (
        /* --- Premium Authentication Screen --- */
        <div className="login-wrapper">
          <div className="login-glow-1"></div>
          <div className="login-glow-2"></div>
          
          <div className="login-card glass">
            <div className="login-header">
              <div className="login-logo">
                {/* Custom Inline TV/Video SVG */}
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              </div>
              <h1 className="login-title">TusKıran</h1>
              <p className="login-subtitle">Devam etmek için hesabınıza giriş yapın</p>
            </div>

            <form onSubmit={login}>
              <div className="form-group">
                <div className="input-container">
                  <input
                    type="email"
                    placeholder="E-posta Adresi"
                    className="input-field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <span className="input-icon">
                    {/* Inline Email SVG */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                  </span>
                </div>
              </div>

              <div className="form-group">
                <div className="input-container">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Şifre"
                    className="input-field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <span className="input-icon">
                    {/* Inline Lock SVG */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </span>
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? (
                      /* Eye Off SVG */
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      /* Eye SVG */
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={`login-button ${isLoggingIn ? "loading" : ""}`}
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <span className="login-button-spinner"></span>
                ) : (
                  "Giriş Yap"
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* --- Premium Authenticated Dashboard --- */
        <div className="dashboard-container">
          
          {/* Header */}
          <header className="dashboard-header">
            <div className="header-logo">
              <div className="logo-icon">TK</div>
              <span className="logo-text">TusKıran</span>
            </div>

            <div className="header-user">
              <div className="user-badge">
                <span className="user-avatar">
                  {user.email ? user.email.charAt(0).toUpperCase() : "U"}
                </span>
                <span>{user.email}</span>
              </div>
              
              <button className="btn-signout" onClick={handleSignOut}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Çıkış Yap
              </button>
            </div>
          </header>

          {/* Core Layout */}
          <div className="dashboard-content-wrapper">
            
            {/* Left Sidebar */}
            <aside className="dashboard-sidebar">
              <div className="sidebar-title">Klasörler</div>
              
              <div className="folders-list">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    className={`folder-item ${activeFolderId === folder.id ? "active" : ""}`}
                    onClick={() => setActiveFolderId(folder.id)}
                  >
                    <div className="folder-item-left">
                      <span className="folder-item-icon">📁</span>
                      <span>{folder.title}</span>
                    </div>
                    <span className="folder-count-badge">
                      {folder.videos ? folder.videos.length : 0} Video
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            {/* Right Content Stream */}
            <main className="dashboard-main-area">
              {!activeFolder ? (
                /* Welcome Screen */
                <div className="welcome-screen">
                  <div className="welcome-icon-container">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                      <line x1="7" y1="2" x2="7" y2="22"></line>
                      <line x1="17" y1="2" x2="17" y2="22"></line>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <line x1="2" y1="7" x2="7" y2="7"></line>
                      <line x1="2" y1="17" x2="7" y2="17"></line>
                      <line x1="17" y1="17" x2="22" y2="17"></line>
                      <line x1="17" y1="7" x2="22" y2="7"></line>
                    </svg>
                  </div>
                  <h2 className="welcome-title">İzlemeye Başlayın</h2>
                  <p className="welcome-desc">
                    Özel eğitim ve video içeriklerinize erişmek için sol taraftaki menüden bir klasör seçin.
                  </p>
                </div>
              ) : (
                /* Video Section Stream */
                <>
                  <div className="video-section-header">
                    <div>
                      <h2 className="section-title">
                        <span>📁</span> {activeFolder.title}
                      </h2>
                      <p className="section-subtitle">
                        Bu klasörde {activeFolder.videos ? activeFolder.videos.length : 0} adet video listeleniyor.
                      </p>
                    </div>
                  </div>

                  <div className="video-grid">
                    {activeFolder.videos && activeFolder.videos.length > 0 ? (
                      activeFolder.videos.map((videoUrl, index) => (
                        <div key={index} className="video-card">
                          
                          {/* Cinema Player View with watermark */}
                          <div className="video-player-container" id={`player-container-${index}`}>
                            
                            {/* SECURE FLOATING WATERMARK */}
                            <div className="video-watermark">
                              {user.email} • {new Date().toLocaleDateString("tr-TR")}
                            </div>

                            <iframe
                              src={videoUrl}
                              className="video-iframe"
                              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                              allowFullScreen
                            />
                          </div>

                          {/* Info footer under player */}
                          <div className="video-info-bar">
                            <div className="video-title-container">
                              <span className="video-play-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M8 5v14l11-7z"></path>
                                </svg>
                              </span>
                              <div>
                                <div className="video-label-title">Video #{index + 1}</div>
                                <div className="video-label-index">Yayında</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <button className="btn-fullscreen" onClick={() => handleFullscreen(index)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                                </svg>
                                Tam Ekran
                              </button>
                              <span className="video-badge">Özel İçerik</span>
                            </div>
                          </div>

                        </div>
                      ))
                    ) : (
                      <div className="welcome-screen">
                        <div className="welcome-icon-container">📭</div>
                        <h3 className="welcome-title">Bu klasör henüz boş</h3>
                        <p className="welcome-desc">
                          Bu klasörde oynatılacak herhangi bir video bulunmamaktadır.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </main>
          </div>
        </div>
      )}
    </>
  );
}

export default App;