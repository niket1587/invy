/* Bridge: runs the Muse invitation on Firebase instead of the Claude artifact runtime.
   It gives the page the same four things it used to get from Claude:
   db (shared live data), user (who is this phone), downloads (CSV save) and sample (AI, turned off).
   Generated from bridge.template.js by build_site.py. Do not edit the copy in the site folder. */
(function () {
  "use strict";
  var FIREBASE_CONFIG = {
  "apiKey": "AIzaSyD1dyb_Wss5B6FMTiS2t5lo21_7T_5V2Dw",
  "authDomain": "pinkal-40th-masquerade.firebaseapp.com",
  "projectId": "pinkal-40th-masquerade",
  "storageBucket": "pinkal-40th-masquerade.firebasestorage.app",
  "messagingSenderId": "64423892430",
  "appId": "1:64423892430:web:d9f5ccaf12390cefe6879f"
};
  var HOST_UID = "6ilMT4CzE1MLcBBj6asfVVU0YJs2";
  var params = new URLSearchParams(location.search);
  var fb = window.firebase;

  function none() { return Promise.resolve(null); }
  if (!fb || !fb.initializeApp) {
    /* Firebase library did not load (offline or blocked). The page still works on this device alone. */
    window.claude = { use: none };
    return;
  }

  fb.initializeApp(FIREBASE_CONFIG);
  var auth = fb.auth();
  var fs = fb.firestore();
  try { fs.settings({ ignoreUndefinedProperties: true, experimentalAutoDetectLongPolling: true }); } catch (e) { /* already set */ }

  /* ?session keeps the sign-in per tab, so two tabs can act as two different people while testing. */
  var persistence = params.has("session") ? fb.auth.Auth.Persistence.SESSION : fb.auth.Auth.Persistence.LOCAL;
  var persistReady = auth.setPersistence(persistence).catch(function () { /* use default */ });

  var ready = persistReady.then(function () {
    return new Promise(function (resolve) {
      var done = false, unsub = null;
      function finish(u) { if (done) return; done = true; if (unsub) unsub(); resolve(u || null); }
      var timer = setTimeout(function () { finish(null); }, 15000);
      unsub = auth.onAuthStateChanged(function (u) {
        if (u) { clearTimeout(timer); finish(u); }
        else { auth.signInAnonymously().catch(function () { clearTimeout(timer); finish(null); }); }
      }, function () { clearTimeout(timer); finish(null); });
    });
  });

  function isHost(u) { return !!(u && !u.isAnonymous && u.uid === HOST_UID); }

  function saveFile(o) {
    return new Promise(function (resolve, reject) {
      try {
        var isCsv = /\.csv$/i.test(o.filename);
        var blob = new Blob([isCsv ? "﻿" + o.data : o.data], { type: isCsv ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = o.filename; a.style.display = "none";
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
        resolve();
      } catch (e) { reject(e); }
    });
  }

  window.claude = {
    use: function (name) {
      if (name === "db") return ready.then(function (u) { return u ? fs : null; });
      if (name === "user") {
        return ready.then(function (u) {
          if (!u) return null;
          return {
            id: function () { return Promise.resolve(u.uid); },
            canEdit: function () { return isHost(u); },
            isOwner: function () { return isHost(u); }
          };
        });
      }
      if (name === "downloads") return Promise.resolve({ save: saveFile });
      return none(); /* "sample" (AI) and anything else: not available, the page falls back to its built-in FAQ */
    }
  };

  /* ---------- Host sign-in (a small link in the footer, or open the site with ?host) ---------- */
  function setup() {
    var css = document.createElement("style");
    css.textContent =
      '.hostlink{display:inline-block;margin-top:14px;padding:10px 14px;min-height:44px;color:inherit;opacity:.65;font:inherit;text-decoration:underline;background:none;border:0;cursor:pointer}' +
      '.hostask{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(6,2,4,.85)}' +
      '.hostask[hidden]{display:none}' +
      '.hostask-card{width:min(360px,100%);display:grid;gap:12px;padding:22px 18px;border:1px solid var(--gold);background:linear-gradient(180deg,var(--wine),var(--velvet))}' +
      '.hostask-card p{margin:0;font:italic 400 1.2rem var(--display);color:var(--parch);text-align:center}' +
      '.hostask-card input{width:100%;font:400 1rem var(--body);color:var(--parch);background:var(--velvet);border:1px solid var(--line);border-radius:2px;padding:12px 14px;min-height:48px}' +
      '.hostask-card .err{min-height:1.2em;text-align:center}';
    document.head.appendChild(css);

    var modal = document.createElement("div");
    modal.className = "hostask"; modal.hidden = true; modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-labelledby", "hostAskT");
    modal.innerHTML =
      '<form class="hostask-card" id="hostForm"><p id="hostAskT">Host sign-in</p>' +
      '<input id="hostEmail" type="email" autocomplete="username" placeholder="Email" aria-label="Email">' +
      '<input id="hostPw" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password">' +
      '<p class="err" id="hostErr" role="alert" style="font:400 .9rem var(--body)"></p>' +
      '<button class="btn gold" type="submit" id="hostGo">Sign in</button>' +
      '<button class="btn quiet" type="button" id="hostNo">Cancel</button></form>';
    document.body.appendChild(modal);

    var link = document.createElement("button");
    link.type = "button"; link.className = "hostlink"; link.textContent = "Host sign-in";
    var foot = document.querySelector("footer");
    if (foot) { foot.appendChild(document.createElement("br")); foot.appendChild(link); }

    var hostIn = false;
    function openModal() { modal.hidden = false; document.getElementById("hostEmail").focus(); }
    function closeModal() { modal.hidden = true; document.getElementById("hostErr").textContent = ""; }
    document.getElementById("hostNo").addEventListener("click", closeModal);
    link.addEventListener("click", function () {
      if (hostIn) { auth.signOut().then(function () { location.reload(); }); } else { openModal(); }
    });
    document.getElementById("hostForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("hostEmail").value.trim(), pw = document.getElementById("hostPw").value;
      var err = document.getElementById("hostErr"), go = document.getElementById("hostGo");
      if (!email || !pw) { err.textContent = "Enter your email and password."; return; }
      err.textContent = ""; go.disabled = true;
      auth.signInWithEmailAndPassword(email, pw).then(function (cred) {
        if (cred.user.uid !== HOST_UID) { return auth.signOut().then(function () { throw { code: "not-host" }; }); }
        document.getElementById("hostPw").value = "";
        location.reload();
      }).catch(function (e2) {
        err.textContent = e2 && e2.code === "not-host" ? "That account is not the host account." :
          e2 && e2.code === "auth/network-request-failed" ? "No connection. Check your internet and try again." :
          "Could not sign in. Check your email and password.";
        go.disabled = false;
      });
    });
    ready.then(function (u) {
      hostIn = isHost(u);
      link.textContent = hostIn ? "Host sign out" : "Host sign-in";
      if (params.has("host") && !hostIn) openModal();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup); else setup();
})();
