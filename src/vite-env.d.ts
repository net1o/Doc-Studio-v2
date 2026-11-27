/// <reference types="vite/client" />

declare module 'virtual:firebase-config' {
  const firebaseConfig: {
    projectId: string;
    appId: string;
    apiKey: string;
    authDomain: string;
    storageBucket: string;
    messagingSenderId: string;
    oAuthClientId: string;
  };
  export default firebaseConfig;
}
