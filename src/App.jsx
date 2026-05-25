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

const auth = getAuth(app);

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [folders, setFolders] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const getFolders = async () => {
      const querySnapshot = await getDocs(collection(db, "folders"));

      const folderList = [];

      querySnapshot.forEach((docItem) => {
        folderList.push({
          id: docItem.id,
          ...docItem.data(),
        });
      });

      setFolders(folderList);
    };

    getFolders();
  }, []);

  const login = async () => {
    try {

      const fp = await FingerprintJS.load();
      const result = await fp.get();

      const deviceId = result.visitorId;

      const userCredential =
        await signInWithEmailAndPassword(auth, email, password);

      const uid = userCredential.user.uid;

      const userRef = doc(db, "users", uid);

      const userSnap = await getDoc(userRef);

      // İlk giriş
      if (!userSnap.exists()) {

        await setDoc(userRef, {
          deviceId: deviceId,
        });

        alert("Cihaz kaydedildi");

        return;
      }

      const userData = userSnap.data();

      // Başka cihaz kontrolü
      if (userData.deviceId !== deviceId) {

        await signOut(auth);

        alert("Bu hesap başka cihazda kullanılıyor");

        return;
      }

      alert("Giriş başarılı");

    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "15px",
        width: "700px",
        margin: "50px auto",
        fontFamily: "Arial",
      }}
    >
      {!user ? (
        <>
          <h1>Video Platform</h1>

          <input
            type="email"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />

          <input
            type="password"
            placeholder="Şifre"
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />

          <button onClick={login}>
            Giriş Yap
          </button>
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2>Hoş geldin {user.email}</h2>

            <button onClick={() => signOut(auth)}>
              Çıkış Yap
            </button>
          </div>

          <h2>Klasörler</h2>

          {folders.map((folder) => (
            <div
              key={folder.id}
              style={{
                background: "#f5f5f5",
                padding: "20px",
                borderRadius: "15px",
                marginBottom: "20px",
              }}
            >
              <h3>📁 {folder.title}</h3>

              {folder.videos?.map((video, index) => (
                <div
                  key={index}
                  style={{
                    position: "relative",
                    marginTop: "15px",
                  }}
                >

                  {/* WATERMARK */}
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      zIndex: 10,
                      color: "white",
                      background: "rgba(0,0,0,0.5)",
                      padding: "5px 10px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      pointerEvents: "none",
                    }}
                  >
                    {user.email}
                  </div>

                  <iframe
                    src={video}
                    width="100%"
                    height="400"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowFullScreen
                    style={{
                      border: "none",
                      borderRadius: "10px",
                    }}
                  />

                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default App;