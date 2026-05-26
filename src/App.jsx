import { useState, useEffect, useRef } from "react";
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
  setDoc,
  updateDoc,
  increment
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
  const [activeSubfolderId, setActiveSubfolderId] = useState(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState({});
  
  // Custom interactive states
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Admin configurations
  const ADMIN_EMAILS = ["admin@tuskiran.com", "bilge@tuskiran.com", "bilgeerngurbuz@gmail.com", "admin@gmail.com"];
  const isAdmin = user && user.email && (
    ADMIN_EMAILS.includes(user.email.toLowerCase()) || 
    user.email.toLowerCase().includes("admin") || 
    user.email.toLowerCase().includes("bilge") ||
    user.email.toLowerCase().includes("gurbuz")
  );

  const isRojbin = user && user.email && user.email.toLowerCase() === "rojbin@bilge.com";

  const [clickHearts, setClickHearts] = useState([]);

  useEffect(() => {
    if (!isRojbin) return;

    const handleGlobalClick = (e) => {
      const id = Date.now() + Math.random().toString(36).substr(2, 9);
      const x = e.clientX;
      const y = e.clientY;
      const symbols = ["❤️", "💖", "💕", "💘", "💝", "🌸", "✨"];
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];

      setClickHearts((prev) => [...prev, { id, x, y, symbol }]);

      setTimeout(() => {
        setClickHearts((prev) => prev.filter((h) => h.id !== id));
      }, 1000);
    };

    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [isRojbin]);

  // Dynamic Romantic Music Player for Rojbin
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!isRojbin) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    const audio = new Audio("https://assets.mixkit.co/music/preview/mixkit-beautiful-dream-493.mp3");
    audio.loop = true;
    audio.volume = 0.3; // Low soft background volume
    audioRef.current = audio;

    const playAudio = () => {
      audio.play().then(() => {
        console.log("Romantic music started playing successfully!");
        window.removeEventListener("click", playAudio);
      }).catch((err) => {
        console.log("Browser blocked autoplay, waiting for first click to play.");
      });
    };

    playAudio();
    window.addEventListener("click", playAudio);

    return () => {
      audio.pause();
      window.removeEventListener("click", playAudio);
    };
  }, [isRojbin]);

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.play().then(() => {
        setIsMuted(false);
        showToast("Müzik Açıldı", "Aşk melodisi arka planda çalıyor. 🌸", "success");
      });
    } else {
      audioRef.current.pause();
      setIsMuted(true);
      showToast("Müzik Duraklatıldı", "Aşk melodisi sessize alındı. 🔇", "info");
    }
  };

  const [editingVideoIndex, setEditingVideoIndex] = useState(null);
  const [newVideoTitle, setNewVideoTitle] = useState("");

  // Statistics and Leaderboard States
  const [activeSection, setActiveSection] = useState("folders"); // "folders" or "leaderboard"
  const [localSiteTime, setLocalSiteTime] = useState(0);
  const [localWatchTime, setLocalWatchTime] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);

  const unsyncedSiteTimeRef = useRef(0);
  const unsyncedWatchTimeRef = useRef(0);

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

  // 1. Fetch user's current saved stats on successful login
  useEffect(() => {
    const fetchUserStats = async () => {
      if (!user) return;
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setLocalSiteTime(data.timeOnSite || 0);
          setLocalWatchTime(data.watchTime || 0);
        }
      } catch (err) {
        console.error("Error fetching user stats:", err);
      }
    };
    fetchUserStats();
  }, [user]);

  // 2. Local second-by-second active session tracking
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      // Sekme aktifse ve odaktaysa (aktiflik kontrolü)
      if (document.hasFocus()) {
        setLocalSiteTime((prev) => {
          unsyncedSiteTimeRef.current += 1;
          return prev + 1;
        });

        // Eğer kullanıcı video izleme sekmesindeyse ve bir klasör seçiliyse
        if (activeFolderId && activeSection === "folders") {
          setLocalWatchTime((prev) => {
            unsyncedWatchTimeRef.current += 1;
            return prev + 1;
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user, activeFolderId, activeSection]);

  // 3. Periodic Firestore batch updates synchronization (every 30 seconds)
  useEffect(() => {
    if (!user) return;

    const syncInterval = setInterval(async () => {
      const siteSecs = unsyncedSiteTimeRef.current;
      const watchSecs = unsyncedWatchTimeRef.current;

      if (siteSecs > 0 || watchSecs > 0) {
        try {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
            timeOnSite: increment(siteSecs),
            watchTime: increment(watchSecs),
            email: user.email // Make sure email is saved for leaderboard
          });

          // Reset unsynced counts by subtracting successfully synced values
          unsyncedSiteTimeRef.current -= siteSecs;
          unsyncedWatchTimeRef.current -= watchSecs;
          console.log(`Successfully synced stats: +${siteSecs}s site, +${watchSecs}s watch time.`);
        } catch (err) {
          console.error("Stats sync error:", err);
        }
      }
    }, 30000);

    return () => clearInterval(syncInterval);
  }, [user]);

  // 4. Fetch global user leaderboard from Firestore
  const fetchLeaderboard = async () => {
    setIsLeaderboardLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList = [];
      querySnapshot.forEach((docItem) => {
        const data = docItem.data();
        if (data.email) {
          usersList.push({
            id: docItem.id,
            email: data.email,
            timeOnSite: data.timeOnSite || 0,
            watchTime: data.watchTime || 0
          });
        }
      });

      // Sort users by active watchTime descending
      const sorted = usersList.sort((a, b) => b.watchTime - a.watchTime);
      setLeaderboard(sorted);
    } catch (err) {
      showToast("Hata", "Lider tablosu yüklenemedi.", "error");
    } finally {
      setIsLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === "leaderboard") {
      fetchLeaderboard();
    }
  }, [activeSection]);

  // 5. Dynamic time formatting helper (formats seconds to hh:mm:ss premium display)
  const formatDuration = (totalSeconds) => {
    if (!totalSeconds || isNaN(totalSeconds)) return "0sn";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}sa ${minutes}dk`;
    }
    if (minutes > 0) {
      return `${minutes}dk ${seconds}sn`;
    }
    return `${seconds}sn`;
  };

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

  const getFolderName = (folder) => {
    if (!folder) return "";
    
    // 1. Try to find dynamic keys inside document fields (excluding metadata/arrays like subfolders, videos, id)
    const key = Object.keys(folder).find(k => 
      /title|name|baslik|isim|label/i.test(k) && 
      k !== "id" && 
      k !== "subfolders" && 
      k !== "videos"
    );
    
    if (key && folder[key] && typeof folder[key] === "string") {
      return folder[key];
    }
    
    // 2. Fallback to document ID if no field matches
    if (folder.id) {
      // Capitalize the first letter for a clean premium look (e.g. 'farmakoloji' -> 'Farmakoloji')
      return folder.id.charAt(0).toUpperCase() + folder.id.slice(1);
    }
    
    return "Adsız Klasör";
  };
  const handleSelectFolder = (folder) => {
    setActiveFolderId(folder.id);
    if (Array.isArray(folder.subfolders) && folder.subfolders.length > 0) {
      setExpandedFolderIds(prev => ({ ...prev, [folder.id]: true }));
      setActiveSubfolderId(folder.subfolders[0].id); // Auto-select first subfolder
    } else {
      setActiveSubfolderId(null);
    }
  };

  const toggleFolderExpand = (folderId, e) => {
    if (e) e.stopPropagation();
    setExpandedFolderIds(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const getSubfolderName = (sf) => {
    if (!sf) return "";
    const key = Object.keys(sf).find(k => 
      /title|name|baslik|isim|label/i.test(k) && 
      k !== "id" && 
      k !== "videos"
    );
    return key && typeof sf[key] === "string" ? sf[key] : (sf.id ? (sf.id.charAt(0).toUpperCase() + sf.id.slice(1)) : "Alt Klasör");
  };

  const saveVideoTitle = async (index) => {
    if (!newVideoTitle.trim()) {
      showToast("Hata", "Video ismi boş olamaz.", "error");
      return;
    }

    try {
      let updatedVideos;
      let updatedSubfolders;

      if (activeSubfolder) {
        // Update video item inside subfolder
        updatedVideos = activeSubfolder.videos.map((videoItem, idx) => {
          if (idx === index) {
            const isObject = typeof videoItem === "object" && videoItem !== null;
            const videoUrl = isObject ? (videoItem.url || videoItem.link || "") : videoItem;
            if (isObject) {
              const titleKey = Object.keys(videoItem).find(k => /title|name|baslik|isim|label/i.test(k)) || "title";
              return { ...videoItem, [titleKey]: newVideoTitle };
            } else {
              return { title: newVideoTitle, url: videoUrl };
            }
          }
          return videoItem;
        });

        updatedSubfolders = activeFolder.subfolders.map(sf => {
          if (sf.id === activeSubfolder.id) {
            return { ...sf, videos: updatedVideos };
          }
          return sf;
        });

        // Update Firestore doc
        const folderRef = doc(db, "folders", activeFolder.id);
        await setDoc(folderRef, { subfolders: updatedSubfolders }, { merge: true });

        // Update local state
        setFolders(prev => 
          prev.map(f => f.id === activeFolder.id ? { ...f, subfolders: updatedSubfolders } : f)
        );
      } else {
        // Update video item in flat folder
        updatedVideos = activeFolder.videos.map((videoItem, idx) => {
          if (idx === index) {
            const isObject = typeof videoItem === "object" && videoItem !== null;
            const videoUrl = isObject ? (videoItem.url || videoItem.link || "") : videoItem;
            if (isObject) {
              const titleKey = Object.keys(videoItem).find(k => /title|name|baslik|isim|label/i.test(k)) || "title";
              return { ...videoItem, [titleKey]: newVideoTitle };
            } else {
              return { title: newVideoTitle, url: videoUrl };
            }
          }
          return videoItem;
        });

        // Update Firestore doc
        const folderRef = doc(db, "folders", activeFolder.id);
        await setDoc(folderRef, { videos: updatedVideos }, { merge: true });

        // Update local state
        setFolders(prev => 
          prev.map(f => f.id === activeFolder.id ? { ...f, videos: updatedVideos } : f)
        );
      }

      showToast("Başarılı", "Video ismi başarıyla güncellendi.", "success");
      setEditingVideoIndex(null);
    } catch (err) {
      showToast("Hata", "Video ismi güncellenirken bir hata oluştu.", "error");
    }
  };

  const getActiveFolder = () => {
    return folders.find((f) => f.id === activeFolderId) || null;
  };

  const activeFolder = getActiveFolder();

  const getActiveSubfolder = () => {
    if (!activeFolder || !Array.isArray(activeFolder.subfolders) || !activeSubfolderId) return null;
    return activeFolder.subfolders.filter(sf => sf !== null).find(sf => sf.id === activeSubfolderId) || null;
  };

  const activeSubfolder = getActiveSubfolder();

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
        <div className={`dashboard-container ${isRojbin ? "rojbin-theme" : ""}`}>
          {isRojbin && (
            <>
              <div className="floating-hearts-container">
                <div className="heart-bubble h1">❤️</div>
                <div className="heart-bubble h2">💖</div>
                <div className="heart-bubble h3">💕</div>
                <div className="heart-bubble h4">💘</div>
                <div className="heart-bubble h5">❤️</div>
                <div className="heart-bubble h6">💝</div>
                <div className="heart-bubble h7">✨</div>
                <div className="heart-bubble h8">💖</div>
                <div className="heart-bubble h9">💕</div>
                <div className="heart-bubble h10">❤️</div>
                <div className="heart-bubble h11">💖</div>
                <div className="heart-bubble h12">💕</div>
                <div className="heart-bubble h13">💘</div>
                <div className="heart-bubble h14">💝</div>
                <div className="heart-bubble h15">❤️</div>
                <div className="heart-bubble h16">✨</div>
                <div className="heart-bubble h17">💖</div>
                <div className="heart-bubble h18">💕</div>
                <div className="heart-bubble h19">💝</div>
                <div className="heart-bubble h20">❤️</div>
              </div>
              {clickHearts.map((h) => (
                <span
                  key={h.id}
                  className="click-heart"
                  style={{ left: h.x, top: h.y }}
                >
                  {h.symbol}
                </span>
              ))}
            </>
          )}
          
          {/* Header */}
          <header className="dashboard-header">
            <div className="header-logo">
              <div className="logo-icon">{isRojbin ? "❤️" : "TK"}</div>
              <span className="logo-text">TusKıran</span>
            </div>

            <div className="header-user">
              <div className="user-badge" style={isRojbin ? { borderColor: "rgba(244, 63, 94, 0.4)", background: "rgba(244, 63, 94, 0.1)" } : {}}>
                <span className="user-avatar" style={isRojbin ? { background: "linear-gradient(135deg, #f43f5e, #ec4899)", color: "white" } : {}}>
                  {isRojbin ? "💝" : (user.email ? user.email.charAt(0).toUpperCase() : "U")}
                </span>
                <span style={isRojbin ? { color: "#fda4af", fontWeight: "700" } : {}}>{isRojbin ? "Rojbin ❤️" : user.email}</span>
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
              
              {/* Sidebar Tabs */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                <button 
                  className={`folder-item ${activeSection === "folders" ? "active" : ""}`}
                  onClick={() => setActiveSection("folders")}
                  style={{ fontWeight: "600", fontSize: "14px" }}
                >
                  <div className="folder-item-left">
                    <span className="folder-item-icon">📺</span>
                    <span>Eğitim İçerikleri</span>
                  </div>
                </button>
                
                <button 
                  className={`folder-item ${activeSection === "leaderboard" ? "active" : ""}`}
                  onClick={() => setActiveSection("leaderboard")}
                  style={{ fontWeight: "600", fontSize: "14px" }}
                >
                  <div className="folder-item-left">
                    <span className="folder-item-icon">🏆</span>
                    <span>Liderlik Tablosu</span>
                  </div>
                </button>
              </div>

              {activeSection === "folders" ? (
                <>
                  <div className="sidebar-title" style={{ marginTop: "12px" }}>Klasörler</div>
                  
                  <div className="folders-list">
                    {folders.map((folder) => {
                      const hasSubfolders = Array.isArray(folder.subfolders) && folder.subfolders.length > 0;
                      const totalVideos = hasSubfolders 
                        ? folder.subfolders.reduce((acc, sf) => acc + (Array.isArray(sf.videos) ? sf.videos.length : 0), 0)
                        : (Array.isArray(folder.videos) ? folder.videos.length : 0);
                      const isExpanded = expandedFolderIds[folder.id];

                      return (
                        <div key={folder.id} style={{ display: "flex", flexDirection: "column" }}>
                          <button
                            className={`folder-item ${activeFolderId === folder.id && !activeSubfolderId ? "active" : ""}`}
                            onClick={() => handleSelectFolder(folder)}
                          >
                            <div className="folder-item-left">
                              {hasSubfolders && (
                                <span 
                                  className={`chevron-icon ${isExpanded ? "rotated" : ""}`}
                                  onClick={(e) => toggleFolderExpand(folder.id, e)}
                                  style={{ marginRight: "4px", display: "inline-flex", cursor: "pointer" }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                  </svg>
                                </span>
                              )}
                              <span className="folder-item-icon">📁</span>
                              <span>{getFolderName(folder)}</span>
                            </div>
                            <span className="folder-count-badge">
                              {totalVideos} Video
                            </span>
                          </button>

                          {hasSubfolders && (
                            <div className={`folder-sub-list ${isExpanded ? "expanded" : ""}`}>
                              {folder.subfolders.filter(sf => sf !== null).map((subfolder) => (
                                <button
                                  key={subfolder.id}
                                  className={`subfolder-item ${activeFolderId === folder.id && activeSubfolderId === subfolder.id ? "active" : ""}`}
                                  onClick={() => {
                                    setActiveFolderId(folder.id);
                                    setActiveSubfolderId(subfolder.id);
                                  }}
                                >
                                  <div className="subfolder-item-left">
                                    <span className="subfolder-item-icon">↳ 📁</span>
                                    <span>{getSubfolderName(subfolder)}</span>
                                  </div>
                                  <span className="folder-count-badge">
                                    {Array.isArray(subfolder.videos) ? subfolder.videos.length : 0} Video
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Live Sidebar Stats Info for Leaderboard tab */
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px", animation: "fadeIn 0.3s" }}>
                  <div className="sidebar-title">Aktif Süreniz</div>
                  
                  <div className="glass" style={{ padding: "16px", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>⏱ Sitede Kalma</div>
                    <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)" }}>{formatDuration(localSiteTime)}</div>
                  </div>

                  <div className="glass" style={{ padding: "16px", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>🎬 İzleme Süresi</div>
                    <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-purple)", textShadow: "0 0 10px rgba(139,92,246,0.2)" }}>{formatDuration(localWatchTime)}</div>
                  </div>
                </div>
              )}
            </aside>

            {/* Right Content Stream */}
            <main className="dashboard-main-area">
              {activeSection === "leaderboard" ? (
                /* --- Leaderboard Pane --- */
                <div style={{ display: "flex", flexDirection: "column", gap: "24px", animation: "fadeIn 0.4s ease-out" }}>
                  
                  {/* Top Stats Cards */}
                  <div className="stats-grid">
                    <div className="stat-card glass">
                      <div className="stat-card-glow" style={{ background: "rgba(139, 92, 246, 0.15)" }}></div>
                      <div className="stat-card-title">⏱ Sitede Kalma Süreniz</div>
                      <div className="stat-card-value">{formatDuration(localSiteTime)}</div>
                      <div className="stat-card-desc">Platformda aktif olarak geçirdiğiniz toplam süre.</div>
                    </div>

                    <div className="stat-card glass">
                      <div className="stat-card-glow" style={{ background: "rgba(59, 130, 246, 0.15)" }}></div>
                      <div className="stat-card-title">🎬 Aktif İzleme Süreniz</div>
                      <div className="stat-card-value" style={{ color: "var(--accent-purple)" }}>{formatDuration(localWatchTime)}</div>
                      <div className="stat-card-desc">Ders ve eğitim videolarını izlediğiniz toplam süre.</div>
                    </div>
                  </div>

                  {/* Leaderboard Table Container */}
                  <div className="leaderboard-board glass">
                    <div className="leaderboard-title-row">
                      <div>
                        <h2 className="section-title" style={{ fontSize: "20px", marginBottom: "4px" }}>
                          🏆 TusKıran Derece Sıralaması
                        </h2>
                        <p className="section-subtitle" style={{ fontSize: "13px" }}>
                          En çok aktif izleme süresine sahip öğrenciler listeleniyor.
                        </p>
                      </div>
                      
                      <button 
                        className="btn-refresh" 
                        onClick={fetchLeaderboard}
                        disabled={isLeaderboardLoading}
                      >
                        {isLeaderboardLoading ? (
                          <>
                            <span className="login-button-spinner" style={{ width: "12px", height: "12px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", margin: "0" }}></span>
                            Yükleniyor...
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="23 4 23 10 17 10"></polyline>
                              <polyline points="1 20 1 14 7 14"></polyline>
                              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                            Yenile
                          </>
                        )}
                      </button>
                    </div>

                    <div className="leaderboard-table-container">
                      <table className="leaderboard-table">
                        <thead>
                          <tr>
                            <th className="leaderboard-th" style={{ width: "80px", textAlign: "center" }}>Derece</th>
                            <th className="leaderboard-th">Kullanıcı</th>
                            <th className="leaderboard-th">🎬 Aktif İzleme Süresi</th>
                            <th className="leaderboard-th">⏱ Sitede Kalma Süresi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.length > 0 ? (
                            leaderboard.map((u, i) => {
                              const rank = i + 1;
                              let rankClass = "";
                              let trClass = "";
                              let rankIcon = rank;

                              if (rank === 1) {
                                rankClass = "rank-1";
                                trClass = "tr-rank-1";
                                rankIcon = "🥇";
                              } else if (rank === 2) {
                                rankClass = "rank-2";
                                trClass = "tr-rank-2";
                                rankIcon = "🥈";
                              } else if (rank === 3) {
                                rankClass = "rank-3";
                                trClass = "tr-rank-3";
                                rankIcon = "🥉";
                              }

                              const maskEmail = (emailStr) => {
                                if (!emailStr) return "";
                                const [username, domain] = emailStr.split("@");
                                if (!domain) return emailStr;
                                if (username.length <= 2) return `**@${domain}`;
                                return `${username.slice(0, 2)}***@${domain}`;
                              };

                              const isCurrentUser = user && user.email && u.email.toLowerCase() === user.email.toLowerCase();

                              return (
                                <tr key={u.id} className={`leaderboard-tr ${trClass}`} style={isCurrentUser ? { background: "rgba(139, 92, 246, 0.08)", borderLeft: "3px solid var(--accent-purple)" } : {}}>
                                  <td className="leaderboard-td" style={{ textAlign: "center" }}>
                                    <span className={`leaderboard-rank ${rankClass}`}>
                                      {rankIcon}
                                    </span>
                                  </td>
                                  <td className="leaderboard-td leaderboard-td-user" style={{ fontWeight: isCurrentUser ? "700" : "inherit" }}>
                                    {isCurrentUser ? `${u.email} (Siz)` : maskEmail(u.email)}
                                  </td>
                                  <td className="leaderboard-td" style={{ fontWeight: "600", color: rank <= 3 ? "inherit" : "var(--text-primary)" }}>
                                    {formatDuration(u.watchTime)}
                                  </td>
                                  <td className="leaderboard-td">
                                    {formatDuration(u.timeOnSite)}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="4" className="leaderboard-td" style={{ textAlign: "center", padding: "40px" }}>
                                {isLeaderboardLoading ? "Kullanıcı verileri yükleniyor..." : "Sıralama verisi bulunamadı."}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              ) : !activeFolder ? (
                /* Welcome Screen */
                <div className="welcome-screen" style={isRojbin ? { animation: "fadeIn 0.5s ease-out", border: "1px dashed rgba(244, 63, 94, 0.3)", background: "rgba(244, 63, 94, 0.05)" } : {}}>
                  <div className="welcome-icon-container" style={isRojbin ? { background: "rgba(244, 63, 94, 0.15)", color: "#f43f5e", animation: "heartBeat 1.5s infinite" } : {}}>
                    {isRojbin ? "💖" : (
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
                    )}
                  </div>
                  <h2 className="welcome-title" style={isRojbin ? { color: "#fda4af" } : {}}>
                    {isRojbin ? "Hoş Geldin Sevgilim, İyi ki Varsın! ❤️" : "İzlemeye Başlayın"}
                  </h2>
                  <p className="welcome-desc" style={isRojbin ? { color: "#f472b6" } : {}}>
                    {isRojbin 
                      ? "Senin için özel hazırlanan eğitim içeriklerine sol taraftaki menüden ulaşabilirsin. Başarılar dilerim sevgilim! 💕" 
                      : "Özel eğitim ve video içeriklerinize erişmek için sol taraftaki menüden bir klasör seçin."}
                  </p>
                </div>
              ) : (
                /* Video Section Stream */
                <>
                  {Array.isArray(activeFolder.subfolders) && activeFolder.subfolders.length > 0 && !activeSubfolderId ? (
                    /* Subfolder Overview Selection Grid */
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "fadeIn 0.4s" }}>
                      <div className="video-section-header">
                        <div>
                          <h2 className="section-title">
                            <span>📁</span> {getFolderName(activeFolder)}
                          </h2>
                          <p className="section-subtitle">
                            Lütfen ders içeriklerine erişmek için aşağıdaki alt klasörlerden birini seçin.
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "20px", marginTop: "12px" }}>
                        {activeFolder.subfolders.filter(sf => sf !== null).map((sf) => (
                          <div 
                            key={sf.id} 
                            className="video-card glass glass-interactive" 
                            style={{ padding: "28px 24px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-start", borderRadius: "16px" }}
                            onClick={() => setActiveSubfolderId(sf.id)}
                          >
                            <span style={{ fontSize: "36px", filter: "drop-shadow(0 4px 8px rgba(139,92,246,0.3))" }}>📁</span>
                            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)", marginTop: "4px" }}>
                              {getSubfolderName(sf)}
                            </h3>
                            <span className="folder-count-badge" style={{ marginTop: "12px", background: "rgba(139,92,246,0.12)", color: "var(--accent-purple)", fontWeight: "600" }}>
                              {Array.isArray(sf.videos) ? sf.videos.length : 0} Video
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Video Stream (Normal or Subfolder) */
                    (() => {
                      const videosToRender = activeSubfolder ? activeSubfolder.videos : activeFolder.videos;
                      const headerTitle = activeSubfolder 
                        ? `${getFolderName(activeFolder)} ↳ ${getSubfolderName(activeSubfolder)}` 
                        : getFolderName(activeFolder);
                      const totalVideosCount = Array.isArray(videosToRender) ? videosToRender.length : 0;

                      return (
                        <>
                          <div className="video-section-header">
                            <div>
                              <h2 className="section-title">
                                <span>📁</span> {headerTitle}
                              </h2>
                              <p className="section-subtitle">
                                Bu klasörde {totalVideosCount} adet video listeleniyor.
                              </p>
                            </div>
                          </div>

                          <div className="video-grid">
                            {Array.isArray(videosToRender) && videosToRender.length > 0 ? (
                              videosToRender.map((videoItem, index) => {
                                const isObject = typeof videoItem === "object" && videoItem !== null;
                                let videoUrl = "";
                                let videoTitle = `Video #${index + 1}`;

                                if (isObject) {
                                  // Dynamically find title key
                                  const titleKey = Object.keys(videoItem).find(k => 
                                    /title|name|baslik|isim|label|header/i.test(k)
                                  );
                                  videoTitle = titleKey ? videoItem[titleKey] : `Video #${index + 1}`;

                                  // Dynamically find url key
                                  const urlKey = Object.keys(videoItem).find(k => 
                                    /url|link|src|href|path/i.test(k)
                                  );
                                  videoUrl = urlKey ? videoItem[urlKey] : "";
                                } else {
                                  videoUrl = videoItem;
                                }

                                return (
                                  <div key={index} className="video-card">
                                    
                                    {/* Cinema Player View with watermark */}
                                    <div className="video-player-container" id={`player-container-${index}`}>
                                      
                                      {/* SECURE FLOATING WATERMARK */}
                                      <div className="video-watermark">
                                        {isRojbin 
                                          ? `Rojbin ❤️ Bilge • ${new Date().toLocaleDateString("tr-TR")}` 
                                          : `${user.email} • ${new Date().toLocaleDateString("tr-TR")}`}
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
                                          {editingVideoIndex === index ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0" }}>
                                              <input
                                                type="text"
                                                className="input-field"
                                                style={{ padding: "6px 12px", fontSize: "13px", width: "180px" }}
                                                value={newVideoTitle}
                                                onChange={(e) => setNewVideoTitle(e.target.value)}
                                                autoFocus
                                              />
                                              <button 
                                                className="btn-fullscreen" 
                                                style={{ padding: "6px 10px", background: "var(--accent-purple)", color: "white", borderColor: "transparent" }}
                                                onClick={() => saveVideoTitle(index)}
                                              >
                                                Kaydet
                                              </button>
                                              <button 
                                                className="btn-signout" 
                                                style={{ padding: "6px 10px" }}
                                                onClick={() => setEditingVideoIndex(null)}
                                              >
                                                İptal
                                              </button>
                                            </div>
                                          ) : (
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                              <div className="video-label-title">{videoTitle}</div>
                                              {isAdmin && (
                                                <button 
                                                  onClick={() => { setEditingVideoIndex(index); setNewVideoTitle(videoTitle); }}
                                                  style={{ background: "none", border: "none", color: "var(--accent-purple)", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                                                  title="İsmi Düzenle"
                                                >
                                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                  </svg>
                                                </button>
                                              )}
                                            </div>
                                          )}
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
                                );
                              })
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
                      );
                    })()
                  )}
                </>
              )}
            </main>
          </div>
          {isRojbin && (
            <button 
              className={`music-controller-btn glass ${isMuted ? "muted" : "playing"}`} 
              onClick={toggleMusic}
              title={isMuted ? "Müziği Başlat 🎵" : "Müziği Durdur 🔇"}
            >
              <span className="music-icon">
                {isMuted ? "🔇" : "🎵"}
              </span>
              {!isMuted && (
                <div className="music-waves">
                  <span className="wave w1"></span>
                  <span className="wave w2"></span>
                  <span className="wave w3"></span>
                </div>
              )}
              <span className="music-label">{isMuted ? "Müzik Kapalı" : "Aşk Melodisi"}</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}

export default App;