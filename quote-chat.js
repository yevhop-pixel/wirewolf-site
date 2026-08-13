/* Wirewolf instant-quote chat widget.
   Include on any page:  <script src="/quote-chat.js" defer></script>
   Set WORKER_URL below to the deployed Cloudflare Worker endpoint. */
(function () {
  "use strict";

  var WORKER_URL = "https://wirewolf-quote.quote-widget.workers.dev";

  var GREETING =
    "Hey, Wirewolf here 🐺 Tell me what you need — TV mounting, Starlink, " +
    "home theatre, smart home — or send a photo of your wall or roof, " +
    "and I'll price it right here.";

  var css =
    "#ww-chat-btn{position:fixed;right:20px;bottom:20px;z-index:99990;display:flex;align-items:center;gap:10px;" +
    "background:#10161C;color:#fff;border:1px solid #2a333d;border-radius:999px;padding:12px 20px 12px 12px;cursor:pointer;" +
    "font:600 15px/1 'Segoe UI',Arial,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);transition:transform .15s}" +
    "#ww-chat-btn:hover{transform:translateY(-2px)}" +
    "#ww-chat-btn svg{width:30px;height:30px;flex:none}" +
    "#ww-chat-btn .ww-dot{position:absolute;top:6px;right:8px;width:9px;height:9px;border-radius:50%;background:#2ecc71}" +
    "#ww-chat{position:fixed;right:20px;bottom:20px;z-index:99991;width:370px;max-width:calc(100vw - 24px);height:600px;" +
    "max-height:calc(100vh - 40px);display:none;flex-direction:column;background:#fff;border-radius:16px;overflow:hidden;" +
    "box-shadow:0 12px 48px rgba(0,0,0,.45);font-family:'Segoe UI',Arial,sans-serif}" +
    "#ww-chat.open{display:flex}" +
    "#ww-head{background:#10161C;color:#fff;padding:14px 16px;display:flex;align-items:center;gap:12px}" +
    "#ww-head svg{width:34px;height:34px;flex:none}" +
    "#ww-head .t{font-weight:700;font-size:15px;letter-spacing:.03em}" +
    "#ww-head .s{font-size:12px;color:#9aa4af}" +
    "#ww-close{margin-left:auto;background:none;border:0;color:#9aa4af;font-size:22px;cursor:pointer;line-height:1}" +
    "#ww-msgs{flex:1;overflow-y:auto;padding:14px;background:#f4f5f7;display:flex;flex-direction:column;gap:10px}" +
    ".ww-m{max-width:85%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}" +
    ".ww-bot{background:#fff;color:#10161C;border:1px solid #e3e6ea;border-bottom-left-radius:4px;align-self:flex-start}" +
    ".ww-user{background:#FF5A1B;color:#fff;border-bottom-right-radius:4px;align-self:flex-end}" +
    ".ww-user img{max-width:100%;border-radius:8px;display:block;margin-top:6px}" +
    ".ww-typing{align-self:flex-start;color:#5b6470;font-size:13px;padding:4px 8px}" +
    "#ww-note{font-size:11px;color:#8a93a0;text-align:center;padding:4px 12px;background:#f4f5f7}" +
    "#ww-foot{display:flex;align-items:flex-end;gap:8px;padding:10px;background:#fff;border-top:1px solid #e3e6ea}" +
    "#ww-attach{background:none;border:0;cursor:pointer;font-size:20px;padding:8px 4px;color:#5b6470}" +
    "#ww-input{flex:1;border:1px solid #d6dade;border-radius:10px;padding:10px 12px;font:14px 'Segoe UI',Arial,sans-serif;" +
    "resize:none;max-height:110px;outline:none}#ww-input:focus{border-color:#FF5A1B}" +
    "#ww-send{background:#FF5A1B;color:#fff;border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}" +
    "#ww-send:disabled{opacity:.5;cursor:default}" +
    ".ww-file-chip{font-size:12px;background:#10161C;color:#fff;border-radius:8px;padding:4px 8px;margin:0 10px 6px;align-self:flex-start}" +
    "@media(max-width:480px){#ww-chat{right:0;bottom:0;width:100vw;max-width:100vw;height:100%;max-height:100%;border-radius:0}}";

  var wolfSvg =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#10161C"/>' +
    '<g transform="translate(32 32) scale(0.561) translate(-50 -51)">' +
    '<polygon points="50,92 14,46 28,10 50,30 72,10 86,46" fill="#FF5A1B"/>' +
    '<polygon points="37,46 45,53 33,57" fill="#10161C"/><polygon points="63,46 55,53 67,57" fill="#10161C"/></g></svg>';

  var history = []; // [{role, content}] — API-shaped
  var pendingFile = null; // {kind:'image'|'pdf', media, data, name}
  var busy = false;

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function save() {
    try { sessionStorage.setItem("ww-chat", JSON.stringify(history)); } catch (e) {}
  }
  function load() {
    try { history = JSON.parse(sessionStorage.getItem("ww-chat") || "[]"); } catch (e) { history = []; }
  }

  function addBubble(cls, text, imgSrc) {
    var m = el("div", { class: "ww-m " + cls });
    m.textContent = text || "";
    if (imgSrc) {
      var img = el("img", { src: imgSrc, alt: "attachment" });
      m.appendChild(img);
    }
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function renderHistory() {
    msgs.innerHTML = "";
    addBubble("ww-bot", GREETING);
    history.forEach(function (m) {
      if (m.role === "assistant") {
        addBubble("ww-bot", typeof m.content === "string" ? m.content : "");
      } else {
        var text = "", imgSrc = null;
        if (typeof m.content === "string") text = m.content;
        else m.content.forEach(function (b) {
          if (b.type === "text") text += b.text;
          if (b.type === "image") imgSrc = "data:" + b.source.media_type + ";base64," + b.source.data;
          if (b.type === "document") text += (text ? "\n" : "") + "📄 (document attached)";
        });
        addBubble("ww-user", text, imgSrc);
      }
    });
  }

  function resizeImage(file, cb) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      var MAX = 1400, w = img.width, h = img.height;
      if (Math.max(w, h) > MAX) { var k = MAX / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      cb(c.toDataURL("image/jpeg", 0.85).split(",")[1], "image/jpeg");
    };
    img.onerror = function () { cb(null); };
    img.src = url;
  }

  function fileToBase64(file, cb) {
    var r = new FileReader();
    r.onload = function () { cb(String(r.result).split(",")[1]); };
    r.onerror = function () { cb(null); };
    r.readAsDataURL(file);
  }

  function setTyping(on) {
    var t = document.getElementById("ww-typing");
    if (on && !t) {
      t = el("div", { class: "ww-typing", id: "ww-typing" }, "typing…");
      msgs.appendChild(t);
      msgs.scrollTop = msgs.scrollHeight;
    } else if (!on && t) t.remove();
  }

  function send() {
    if (busy) return;
    var text = input.value.trim();
    if (!text && !pendingFile) return;

    var blocks = [];
    var imgSrc = null;
    if (pendingFile) {
      if (pendingFile.kind === "image") {
        blocks.push({ type: "image", source: { type: "base64", media_type: pendingFile.media, data: pendingFile.data } });
        imgSrc = "data:" + pendingFile.media + ";base64," + pendingFile.data;
      } else {
        blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pendingFile.data } });
      }
    }
    blocks.push({ type: "text", text: text || "(see attachment)" });

    history.push({ role: "user", content: blocks });
    addBubble("ww-user", text || (pendingFile && pendingFile.kind === "pdf" ? "📄 " + pendingFile.name : ""), imgSrc);
    input.value = "";
    clearFile();
    save();

    busy = true;
    sendBtn.disabled = true;
    setTyping(true);
    var t0 = Date.now();
    var MIN_DELAY = 4000; // feel human: never reply faster than 4s

    fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var reply = d.reply || "Sorry, something went wrong — text us at (705) 717-7074.";
        var show = function () {
          history.push({ role: "assistant", content: reply });
          save();
          setTyping(false);
          addBubble("ww-bot", reply);
        };
        var elapsed = Date.now() - t0;
        if (elapsed < MIN_DELAY) setTimeout(show, MIN_DELAY - elapsed);
        else show();
      })
      .catch(function () {
        setTyping(false);
        addBubble("ww-bot", "Connection hiccup — please try again, or text us at (705) 717-7074.");
      })
      .finally(function () {
        busy = false;
        sendBtn.disabled = false;
        input.focus();
      });
  }

  function clearFile() {
    pendingFile = null;
    var chip = document.getElementById("ww-file-chip");
    if (chip) chip.remove();
  }

  function showFileChip(name) {
    clearFile();
    var chip = el("div", { class: "ww-file-chip", id: "ww-file-chip" });
    chip.textContent = "📎 " + name + "  ✕";
    chip.style.cursor = "pointer";
    chip.onclick = clearFile;
    foot.parentNode.insertBefore(chip, foot);
  }

  /* ---------- build DOM ---------- */
  var style = el("style");
  style.textContent = css;
  document.head.appendChild(style);

  var btn = el("button", { id: "ww-chat-btn", "aria-label": "Get your quote online" },
    wolfSvg + "<span>Get your quote</span><span class='ww-dot'></span>");
  document.body.appendChild(btn);

  var panel = el("div", { id: "ww-chat", role: "dialog", "aria-label": "Wirewolf quote chat" });
  panel.innerHTML =
    "<div id='ww-head'>" + wolfSvg +
    "<div><div class='t'>WIREWOLF — INSTANT QUOTE</div><div class='s'>Usually replies in under a minute</div></div>" +
    "<button id='ww-close' aria-label='Close'>✕</button></div>" +
    "<div id='ww-msgs'></div>" +
    "<div id='ww-note'>Prices in chat are estimates — your flat quote is confirmed in writing. <a href='/terms.html' style='color:#8a93a0'>Terms</a></div>" +
    "<div id='ww-foot'>" +
    "<button id='ww-attach' title='Attach a photo or PDF' aria-label='Attach a photo or PDF'>📷</button>" +
    "<textarea id='ww-input' rows='1' placeholder='Type here… e.g. Starlink on a 2-storey roof in Barrie'></textarea>" +
    "<button id='ww-send' aria-label='Send'>➤</button></div>";
  document.body.appendChild(panel);

  var fileInput = el("input", { type: "file", accept: "image/*,application/pdf", style: "display:none" });
  document.body.appendChild(fileInput);

  var msgs = panel.querySelector("#ww-msgs");
  var input = panel.querySelector("#ww-input");
  var sendBtn = panel.querySelector("#ww-send");
  var foot = panel.querySelector("#ww-foot");

  btn.onclick = function () {
    load();
    renderHistory();
    panel.classList.add("open");
    btn.style.display = "none";
    input.focus();
  };
  panel.querySelector("#ww-close").onclick = function () {
    panel.classList.remove("open");
    btn.style.display = "flex";
  };
  sendBtn.onclick = send;
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  panel.querySelector("#ww-attach").onclick = function () { fileInput.click(); };
  fileInput.onchange = function () {
    var f = fileInput.files[0];
    fileInput.value = "";
    if (!f) return;
    if (f.type === "application/pdf") {
      if (f.size > 3_000_000) { addBubble("ww-bot", "That PDF is a bit large — anything under 3 MB works."); return; }
      fileToBase64(f, function (data) {
        if (!data) return;
        pendingFile = { kind: "pdf", media: "application/pdf", data: data, name: f.name };
        showFileChip(f.name);
      });
    } else if (f.type.indexOf("image/") === 0) {
      resizeImage(f, function (data, media) {
        if (!data) return;
        pendingFile = { kind: "image", media: media, data: data, name: f.name };
        showFileChip(f.name);
      });
    }
  };
})();
