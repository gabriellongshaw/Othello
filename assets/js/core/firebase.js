import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyC-auE42otAASwGmgqO-SHQB7JFxH0nwGc",
  authDomain: "othello-12803.firebaseapp.com",
  projectId: "othello-12803",
  storageBucket: "othello-12803.firebasestorage.app",
  messagingSenderId: "431446738898",
  appId: "1:431446738898:web:5ae8129b14c57bfda86a0b",
  measurementId: "G-60L6E0S12V"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

window.addEventListener('beforeunload', () => {
  const user = auth.currentUser;
  if (user && user.isAnonymous) user.delete();
});

export function waitForAuth() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub();
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth)
          .then(() => {
            const unsub2 = onAuthStateChanged(auth, u => {
              if (u) { unsub2(); resolve(u); }
            });
          })
          .catch(reject);
      }
    });
  });
}