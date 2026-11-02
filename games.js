(function () {
  const root = document.querySelector("[data-arcade]");
  if (!root) return;

  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => Array.from(root.querySelectorAll(sel));
  const fmt = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 });
  const fmtX = (m) => m.toFixed(2).replace(".", ",") + "×";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const HOUSE = 0.97;

  function addHistory(list, text, cls) {
    const li = document.createElement("li");
    li.textContent = text;
    if (cls) li.className = cls;
    list.prepend(li);
    while (list.children.length > 10) list.lastElementChild.remove();
  }

  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // som
  const sfx = (() => {
    const KEY = "pecunia-som";
    let on = localStorage.getItem(KEY) !== "0";
    let ctx = null;
    let hum = null;

    function audio() {
      if (!on) return null;
      if (!ctx) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        ctx = new C();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function tone(freq, dur, opts) {
      const c = audio();
      if (!c) return;
      const { type = "sine", vol = 0.12, at = 0, slide = 0 } = opts || {};
      const t = c.currentTime + at;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    function noise(dur, vol) {
      const c = audio();
      if (!c) return;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = c.createBufferSource();
      const filter = c.createBiquadFilter();
      const g = c.createGain();
      src.buffer = buf;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1800, c.currentTime);
      filter.frequency.exponentialRampToValueAtTime(120, c.currentTime + dur);
      g.gain.value = vol;
      src.connect(filter).connect(g).connect(c.destination);
      src.start();
    }

    const notes = (list, step, opts) => list.forEach((f, i) => tone(f, 0.2, { ...opts, at: i * step }));

    return {
      get on() { return on; },
      toggle() {
        on = !on;
        localStorage.setItem(KEY, on ? "1" : "0");
        if (!on) this.humStop();
        return on;
      },
      tick: () => tone(1900, 0.025, { type: "square", vol: 0.03 }),
      chip: () => tone(720, 0.06, { type: "triangle", vol: 0.08 }),
      bet: () => { tone(420, 0.08, { type: "triangle", vol: 0.08 }); tone(560, 0.08, { type: "triangle", vol: 0.08, at: 0.06 }); },
      win: () => notes([523, 659, 784, 1047], 0.08, { type: "triangle", vol: 0.12 }),
      big: () => notes([523, 659, 784, 1047, 1319, 1568, 2093], 0.07, { type: "triangle", vol: 0.13 }),
      lose: () => tone(330, 0.4, { type: "sawtooth", vol: 0.05, slide: 100 }),
      gem: (n) => tone(660 + n * 70, 0.12, { vol: 0.14, slide: 990 + n * 90 }),
      boom: () => { noise(0.6, 0.35); tone(140, 0.5, { vol: 0.25, slide: 35 }); },
      coin: () => { tone(988, 0.08, { type: "square", vol: 0.05 }); tone(1319, 0.3, { type: "square", vol: 0.05, at: 0.08 }); },
      humStart() {
        const c = audio();
        if (!c || hum) return;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = "triangle";
        o.frequency.value = 160;
        g.gain.setValueAtTime(0.0001, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.035, c.currentTime + 0.2);
        o.connect(g).connect(c.destination);
        o.start();
        hum = { o, g };
      },
      humSet(m) {
        if (hum) hum.o.frequency.setTargetAtTime(Math.min(160 * Math.sqrt(m) * 1.4, 1400), ctx.currentTime, 0.05);
      },
      humStop() {
        if (!hum) return;
        const { o, g } = hum;
        hum = null;
        g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
        o.stop(ctx.currentTime + 0.3);
      },
    };
  })();

  // efeitos
  const fx = (() => {
    const COLORS = ["#ff7eb3", "#e94d93", "#c9a7ff", "#8a5cf0", "#bff0e0", "#fff0a8"];
    const cv = document.createElement("canvas");
    cv.className = "confetti";
    cv.setAttribute("aria-hidden", "true");
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d");
    let parts = [];
    let running = false;

    function size() {
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(innerWidth * dpr);
      cv.height = Math.round(innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function step() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter((p) => p.y < innerHeight + 40 && p.life < 260);
      parts.forEach((p) => {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life += 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, (260 - p.life) / 40);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        if (p.heart) {
          ctx.font = p.s * 2 + "px sans-serif";
          ctx.fillText("♥", -p.s * 0.7, p.s * 0.7);
        } else {
          ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        }
        ctx.restore();
      });
      if (parts.length) requestAnimationFrame(step);
      else running = false;
    }

    function burst(x, y, n, power) {
      if (reduced) return;
      const pw = power || 1;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (3 + Math.random() * 9) * pw;
        parts.push({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 6 * pw,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.4,
          s: 5 + Math.random() * 6,
          c: COLORS[Math.floor(Math.random() * COLORS.length)],
          heart: Math.random() < 0.3,
          life: 0,
        });
      }
      if (!running) {
        running = true;
        size();
        requestAnimationFrame(step);
      }
    }

    function from(el, n, power) {
      const r = el.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, n, power);
    }

    function rain() {
      if (reduced) return;
      for (let i = 0; i < 6; i++) setTimeout(() => burst(Math.random() * innerWidth, -20, 30, 0.6), i * 120);
    }

    function shake(el) {
      if (!reduced) replay(el, "shake");
    }

    addEventListener("resize", () => { if (running) size(); });
    return { burst, from, rain, shake };
  })();

  // saldo
  const KEY = "pecunia-moedas";
  const balanceEl = $("[data-balance]");
  const balanceBox = $(".balance");
  const streakEl = $("[data-streak]");
  const betInput = $("[data-bet]");
  const refillBtn = $("[data-refill]");
  const soundBtn = $("[data-sound]");
  const toast = $("[data-toast]");
  const saved = localStorage.getItem(KEY);
  let balance = saved === null ? 1000 : Math.max(0, Math.floor(Number(saved)) || 0);
  let shown = balance;
  let countFrame = 0;
  let streak = 0;
  let toastTimer = 0;

  function countTo(target) {
    cancelAnimationFrame(countFrame);
    const from = shown;
    const t0 = performance.now();
    const dur = reduced ? 0 : Math.min(900, 250 + Math.abs(target - from) * 1.5);
    const step = (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      shown = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      balanceEl.textContent = fmt.format(shown);
      if (k < 1) countFrame = requestAnimationFrame(step);
    };
    countFrame = requestAnimationFrame(step);
  }

  function floatDelta(diff) {
    const span = document.createElement("span");
    span.className = "delta " + (diff > 0 ? "up" : "down");
    span.textContent = (diff > 0 ? "+" : "−") + fmt.format(Math.abs(diff));
    balanceBox.appendChild(span);
    setTimeout(() => span.remove(), 1100);
  }

  function setBalance(next, kind) {
    const prev = balance;
    balance = Math.max(0, Math.floor(next));
    localStorage.setItem(KEY, String(balance));
    refillBtn.hidden = balance >= 1;
    if (!kind) {
      shown = balance;
      balanceEl.textContent = fmt.format(balance);
      return;
    }
    countTo(balance);
    floatDelta(balance - prev);
    replay(balanceEl, kind);
  }

  function setStreak(won) {
    streak = won ? streak + 1 : 0;
    streakEl.hidden = streak < 2;
    streakEl.textContent = "🔥 " + streak + " seguidas";
    if (streak >= 2) replay(streakEl, "bump");
  }

  function showToast(text) {
    clearTimeout(toastTimer);
    toast.textContent = text;
    replay(toast, "show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function readBet() {
    const v = Math.floor(Number(betInput.value));
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  function takeBet(msgEl) {
    const bet = readBet();
    let problem = "";
    if (!bet) problem = "Escreve uma aposta de pelo menos 1 moeda.";
    else if (bet > balance) problem = balance ? "Não tens moedas suficientes para essa aposta." : "Ficaste sem moedas! Pede mais ao chat.";
    if (problem) {
      msgEl.textContent = problem;
      fx.shake(betInput);
      sfx.lose();
      return 0;
    }
    sfx.bet();
    setBalance(balance - bet, "down");
    return bet;
  }

  function celebrate(win, stake, el) {
    setBalance(balance + win, "up");
    setStreak(true);
    const ratio = win / stake;
    if (ratio >= 5) {
      sfx.big();
      fx.from(el, 140, 1.4);
      fx.rain();
      showToast("MEGA GG ✦ +" + fmt.format(win));
    } else {
      sfx.win();
      fx.from(el, ratio >= 2 ? 70 : 35);
      if (streak >= 3) showToast("🔥 " + streak + " vitórias seguidas!");
    }
  }

  function lost(el) {
    setStreak(false);
    sfx.lose();
    fx.shake(el);
  }

  $$("[data-bet-op]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cur = readBet() || 1;
      const op = btn.dataset.betOp;
      const next = op === "half" ? Math.floor(cur / 2) : op === "double" ? cur * 2 : balance;
      betInput.value = Math.max(1, Math.min(next, Math.max(balance, 1)));
      sfx.chip();
      replay(betInput, "bump");
    });
  });
  refillBtn.addEventListener("click", () => {
    setBalance(balance + 500, "up");
    sfx.coin();
    fx.from(balanceEl, 40);
    showToast("O chat mandou 500 moedas ♡");
  });
  function paintSound() {
    soundBtn.textContent = sfx.on ? "🔊" : "🔇";
    soundBtn.setAttribute("aria-pressed", String(sfx.on));
  }
  soundBtn.addEventListener("click", () => {
    sfx.toggle();
    paintSound();
    sfx.chip();
  });
  paintSound();
  setBalance(balance);

  // tabs
  const tabs = $$('[role="tab"]');
  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) tab.focus();
    sfx.chip();
    if (tab.id === "tab-crash") crash.resize();
  }
  function lockTabs(locked, keep) {
    tabs.forEach((t) => { t.disabled = locked && t !== keep; });
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(t));
    t.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      let j = i;
      do { j = (j + d + tabs.length) % tabs.length; } while (tabs[j].disabled && j !== i);
      selectTab(tabs[j], true);
    });
  });

  // roleta
  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = (n) => (n === 0 ? "green" : REDS.has(n) ? "red" : "black");
  const SEG = 360 / ORDER.length;
  const BETS = {
    red: { label: "no vermelho", pays: 2, wins: (n) => colorOf(n) === "red" },
    black: { label: "no preto", pays: 2, wins: (n) => colorOf(n) === "black" },
    even: { label: "no par", pays: 2, wins: (n) => n !== 0 && n % 2 === 0 },
    odd: { label: "no ímpar", pays: 2, wins: (n) => n % 2 === 1 },
    low: { label: "no 1–18", pays: 2, wins: (n) => n >= 1 && n <= 18 },
    high: { label: "no 19–36", pays: 2, wins: (n) => n >= 19 },
  };

  const wheel = $("[data-wheel]");
  const wheelWrap = $(".wheel-wrap");
  const pointer = $(".pointer");
  const hub = $("[data-wheel-result]");
  const spinBtn = $("[data-spin]");
  const rMsg = $("[data-roulette-msg]");
  const rHist = $("[data-roulette-history]");
  const numInput = $("[data-pick-number]");
  const pickBtns = $$("[data-pick]");
  const NS = "http://www.w3.org/2000/svg";
  const pt = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [(r * Math.sin(a)).toFixed(2), (-r * Math.cos(a)).toFixed(2)];
  };

  const segs = ORDER.map((n, i) => {
    const a0 = i * SEG - SEG / 2;
    const a1 = a0 + SEG;
    const [x0, y0] = pt(97, a0);
    const [x1, y1] = pt(97, a1);
    const [x2, y2] = pt(62, a1);
    const [x3, y3] = pt(62, a0);
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", `M${x0} ${y0}A97 97 0 0 1 ${x1} ${y1}L${x2} ${y2}A62 62 0 0 0 ${x3} ${y3}Z`);
    path.setAttribute("class", "seg " + colorOf(n));
    wheel.appendChild(path);
    return path;
  });
  ORDER.forEach((n, i) => {
    const [tx, ty] = pt(82, i * SEG);
    const text = document.createElementNS(NS, "text");
    text.setAttribute("x", tx);
    text.setAttribute("y", ty);
    text.setAttribute("transform", `rotate(${i * SEG} ${tx} ${ty})`);
    text.textContent = n;
    wheel.appendChild(text);
  });
  const inner = document.createElementNS(NS, "circle");
  inner.setAttribute("r", "62");
  inner.setAttribute("class", "inner");
  wheel.appendChild(inner);

  let pick = "red";
  let rotation = 0;
  let spinning = false;

  function setPick(p) {
    pick = p;
    pickBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pick === p)));
  }
  pickBtns.forEach((b) => b.addEventListener("click", () => {
    numInput.value = "";
    setPick(b.dataset.pick);
    sfx.chip();
  }));
  numInput.addEventListener("input", () => setPick(numInput.value === "" ? "red" : null));

  function wheelAngle() {
    const m = getComputedStyle(wheel).transform;
    if (!m || m === "none") return 0;
    const [a, b] = m.slice(m.indexOf("(") + 1).split(",").map(Number);
    return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  }

  function watchTicks() {
    let lastSeg = -1;
    const loop = () => {
      if (!spinning) return;
      const seg = Math.floor(((wheelAngle() + SEG / 2) % 360) / SEG);
      if (seg !== lastSeg) {
        if (lastSeg !== -1) {
          sfx.tick();
          replay(pointer, "flick");
        }
        lastSeg = seg;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  spinBtn.addEventListener("click", () => {
    if (spinning) return;
    let bet = BETS[pick];
    if (!bet) {
      const n = Number(numInput.value);
      if (!Number.isInteger(n) || n < 0 || n > 36) {
        rMsg.textContent = "Escolhe um número entre 0 e 36.";
        fx.shake(numInput);
        return;
      }
      bet = { label: "no " + n, pays: 36, wins: (r) => r === n };
    }
    const stake = takeBet(rMsg);
    if (!stake) return;

    spinning = true;
    spinBtn.disabled = true;
    pickBtns.forEach((b) => { b.disabled = true; });
    numInput.disabled = true;
    segs.forEach((s) => s.classList.remove("hit"));
    wheelWrap.classList.add("spinning");
    hub.textContent = "…";
    hub.className = "wheel-hub";
    rMsg.textContent = "A roleta está a girar…";

    const idx = Math.floor(Math.random() * ORDER.length);
    const result = ORDER[idx];
    const jitter = (Math.random() - 0.5) * SEG * 0.7;
    const base = ((-(idx * SEG + jitter)) % 360 + 360) % 360;
    rotation = Math.ceil(rotation / 360) * 360 + 360 * 5 + base;
    wheel.style.transform = `rotate(${rotation}deg)`;
    watchTicks();

    setTimeout(() => {
      spinning = false;
      spinBtn.disabled = false;
      pickBtns.forEach((b) => { b.disabled = false; });
      numInput.disabled = false;
      wheelWrap.classList.remove("spinning");
      segs[idx].classList.add("hit");
      const c = colorOf(result);
      hub.textContent = result;
      hub.className = "wheel-hub " + c;
      if (bet.wins(result)) {
        const win = stake * bet.pays;
        rMsg.textContent = `Saiu ${result}! Apostaste ${bet.label} e ganhaste ${fmt.format(win)} moedas ♡`;
        celebrate(win, stake, hub);
      } else {
        rMsg.textContent = `Saiu ${result}. Desta vez não deu ${bet.label}, fica para a próxima.`;
        lost(hub);
      }
      addHistory(rHist, String(result), c);
    }, reduced ? 300 : 4300);
  });

  // minas
  const SIZE = 25;
  const grid = $("[data-mines-grid]");
  const countBtns = $$("[data-mine-count] [data-n]");
  const mMult = $("[data-mines-mult]");
  const mNext = $("[data-mines-next]");
  const mWin = $("[data-mines-win]");
  const mAction = $("[data-mines-action]");
  const mMsg = $("[data-mines-msg]");
  let mineCount = 3;
  let mines = new Set();
  let revealed = 0;
  let minesStake = 0;
  let minesOn = false;

  const cells = Array.from({ length: SIZE }, (_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cell";
    b.disabled = true;
    b.style.setProperty("--i", i);
    b.setAttribute("aria-label", "Casa " + (i + 1));
    b.addEventListener("click", () => reveal(i));
    grid.appendChild(b);
    return b;
  });

  function multFor(n) {
    if (!n) return 1;
    let m = HOUSE;
    for (let k = 0; k < n; k++) m *= (SIZE - k) / (SIZE - mineCount - k);
    return m;
  }

  function updateMines() {
    const cashout = Math.floor(minesStake * multFor(revealed));
    mMult.textContent = fmtX(multFor(revealed));
    mNext.textContent = revealed < SIZE - mineCount ? fmtX(multFor(revealed + 1)) : "—";
    mWin.textContent = fmt.format(minesOn ? cashout : 0);
    if (minesOn) {
      mAction.textContent = revealed ? "Levantar " + fmt.format(cashout) + " moedas" : "Escolhe uma casa";
      mAction.disabled = !revealed;
    } else {
      mAction.textContent = "Começar";
      mAction.disabled = false;
    }
    grid.classList.toggle("live", minesOn);
    countBtns.forEach((b) => { b.disabled = minesOn; });
  }

  countBtns.forEach((b) => {
    b.addEventListener("click", () => {
      mineCount = Number(b.dataset.n);
      countBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      revealed = 0;
      sfx.chip();
      updateMines();
    });
  });

  function startMines() {
    const stake = takeBet(mMsg);
    if (!stake) return;
    minesStake = stake;
    minesOn = true;
    revealed = 0;
    const pool = Array.from({ length: SIZE }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    mines = new Set(pool.slice(0, mineCount));
    cells.forEach((c, i) => {
      c.className = "cell deal";
      c.textContent = "";
      c.disabled = false;
      c.setAttribute("aria-label", "Casa " + (i + 1) + ", escondida");
    });
    mMsg.textContent = mineCount + (mineCount === 1 ? " mina escondida" : " minas escondidas") + ". Boa sorte!";
    updateMines();
  }

  function reveal(i) {
    if (!minesOn) return;
    const c = cells[i];
    c.disabled = true;
    c.classList.remove("deal");
    c.classList.add("open");
    if (mines.has(i)) {
      c.classList.add("boom");
      c.textContent = "💣";
      c.setAttribute("aria-label", "Casa " + (i + 1) + ", mina");
      sfx.boom();
      fx.shake(grid);
      endMines(false, i);
      return;
    }
    revealed += 1;
    c.classList.add("gem");
    c.textContent = "💎";
    c.setAttribute("aria-label", "Casa " + (i + 1) + ", diamante");
    sfx.gem(revealed);
    fx.from(c, 10, 0.5);
    replay(mMult, "bump");
    if (revealed === SIZE - mineCount) {
      cashOutMines();
      return;
    }
    mMsg.textContent = revealed >= 5 ? "Estás on fire! Arriscas mais uma?" : "Diamante! Continuas ou levantas?";
    updateMines();
  }

  function cashOutMines() {
    const win = Math.floor(minesStake * multFor(revealed));
    mMsg.textContent = `Levantaste ${fmt.format(win)} moedas a ${fmtX(multFor(revealed))}. Bem jogado ♡`;
    sfx.coin();
    celebrate(win, minesStake, mAction);
    endMines(true);
  }

  function endMines(won, hit) {
    minesOn = false;
    if (!won) {
      mMsg.textContent = `💥 Pisaste uma mina! Perdeste ${fmt.format(minesStake)} moedas.`;
      setStreak(false);
    }
    const hidden = cells.filter((c) => !c.classList.contains("open"));
    hidden.forEach((c) => { c.disabled = true; });
    const origin = hit == null ? 12 : hit;
    const dist = (i) => Math.abs((i % 5) - (origin % 5)) + Math.abs(Math.floor(i / 5) - Math.floor(origin / 5));
    cells.forEach((c, i) => {
      if (c.classList.contains("open")) return;
      const show = () => {
        c.classList.remove("deal");
        c.classList.add("ghost");
        c.textContent = mines.has(i) ? "💣" : "💎";
      };
      if (reduced) show();
      else setTimeout(show, 120 + dist(i) * 70);
    });
    updateMines();
  }

  mAction.addEventListener("click", () => (minesOn ? cashOutMines() : startMines()));
  updateMines();

  // último jogo
  const crash = (() => {
    const RATE = 0.00015;
    const LINES = [
      [1.5, "“só mais uma…”"],
      [2, "“ok, último jogo”"],
      [3, "“este é MESMO o último”"],
      [5, "“chat, juro que é o último”"],
      [10, "“já são 4 da manhã…”"],
      [Infinity, "“último jogo” lendário ✦"],
    ];
    const tab = document.getElementById("tab-crash");
    const stage = $("[data-crash-stage]");
    const canvas = $("[data-crash-canvas]");
    const ctx = canvas.getContext("2d");
    const multEl = $("[data-crash-mult]");
    const lineEl = $("[data-crash-line]");
    const btn = $("[data-crash-action]");
    const msg = $("[data-crash-msg]");
    const autoInput = $("[data-crash-auto]");
    const hist = $("[data-crash-history]");

    let running = false;
    let cashed = false;
    let cashedAt = 0;
    let start = 0;
    let point = 1;
    let stake = 0;
    let auto = 0;
    let lastLine = "";
    let last = [0, 1, "idle"];

    const multAt = (t) => Math.exp(RATE * t);
    const lineFor = (m) => LINES.find(([max]) => m < max)[1];

    function draw(t, m, state) {
      last = [t, m, state];
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w) return;
      ctx.clearRect(0, 0, w, h);
      const pad = 26;
      const maxT = Math.max(7000, t * 1.12);
      const maxM = Math.max(2, 1 + (m - 1) * 1.15);
      const X = (x) => pad + (x / maxT) * (w - pad * 2);
      const top = Math.min(110, h * 0.38);
      const Y = (y) => h - pad - ((y - 1) / (maxM - 1)) * (h - pad - top);

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(233, 77, 147, 0.16)";
      ctx.fillStyle = "rgba(74, 35, 64, 0.45)";
      ctx.font = "600 12px Fredoka, sans-serif";
      ctx.textAlign = "right";
      [1, 1 + (maxM - 1) / 2, maxM].forEach((v) => {
        const y = Y(v);
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(w - pad, y);
        ctx.stroke();
        ctx.fillText(v.toFixed(1) + "×", w - pad - 4, y - 5);
      });
      ctx.textAlign = "start";
      if (t <= 0) return;

      const curve = () => {
        ctx.beginPath();
        ctx.moveTo(X(0), Y(1));
        for (let i = 1; i <= 80; i++) {
          const x = (t * i) / 80;
          ctx.lineTo(X(x), Y(multAt(x)));
        }
      };
      const crashed = state === "crashed";
      curve();
      ctx.lineTo(X(t), Y(1));
      ctx.closePath();
      const g = ctx.createLinearGradient(0, Y(m), 0, Y(1));
      g.addColorStop(0, crashed ? "rgba(74, 35, 64, 0.25)" : "rgba(255, 126, 179, 0.4)");
      g.addColorStop(1, "rgba(255, 126, 179, 0)");
      ctx.fillStyle = g;
      ctx.fill();
      curve();
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = crashed ? "#4a2340" : "#e94d93";
      if (!crashed && !reduced) {
        ctx.shadowColor = "rgba(233, 77, 147, 0.6)";
        ctx.shadowBlur = 12 + Math.min(20, m * 2);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (cashedAt && cashedAt <= m) {
        const cx = X(Math.log(cashedAt) / RATE);
        const cy = Y(cashedAt);
        ctx.fillStyle = "#2fa57a";
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "700 13px Fredoka, sans-serif";
        ctx.fillText("saíste " + fmtX(cashedAt), cx + 10, cy + 18);
      }

      const bob = crashed || reduced ? 0 : Math.sin(t / 110) * 3;
      ctx.font = (crashed ? 34 : 26) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(crashed ? "💥" : "🎮", X(t), Y(m) + bob);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(...last);
    }

    function heat(m) {
      stage.style.setProperty("--heat", Math.min(1, (m - 1) / 9).toFixed(3));
    }

    function tick(now) {
      if (!running) return;
      const t = now - start;
      const m = multAt(t);
      if (!cashed && auto && auto < point && m >= auto) cashOut(auto);
      if (m >= point) {
        draw(Math.log(point) / RATE, point, "crashed");
        bust();
        return;
      }
      multEl.textContent = fmtX(m);
      const line = lineFor(m);
      if (line !== lastLine) {
        lastLine = line;
        lineEl.textContent = line;
        replay(lineEl, "bump");
        if (m > 1.1) sfx.chip();
      }
      heat(m);
      sfx.humSet(m);
      draw(t, m, "run");
      requestAnimationFrame(tick);
    }

    function play() {
      const s = takeBet(msg);
      if (!s) return;
      stake = s;
      cashed = false;
      cashedAt = 0;
      running = true;
      lastLine = "";
      const a = Number(autoInput.value);
      auto = a >= 1.01 ? a : 0;
      point = Math.max(1, Math.floor((HOUSE * 100) / (1 - Math.random())) / 100);
      stage.classList.remove("crashed", "won");
      stage.classList.add("running");
      btn.textContent = "Sair agora";
      msg.textContent = "";
      autoInput.disabled = true;
      lockTabs(true, tab);
      sfx.humStart();
      start = performance.now();
      requestAnimationFrame(tick);
    }

    function cashOut(m) {
      if (!running || cashed || m >= point) return;
      cashed = true;
      cashedAt = m;
      const win = Math.floor(stake * m);
      msg.textContent = `Saíste a ${fmtX(m)} e ganhaste ${fmt.format(win)} moedas ♡`;
      stage.classList.add("won");
      btn.disabled = true;
      btn.textContent = "A ver até onde ia…";
      sfx.coin();
      celebrate(win, stake, multEl);
    }

    function bust() {
      running = false;
      sfx.humStop();
      sfx.boom();
      multEl.textContent = fmtX(point);
      lineEl.textContent = "TILT! fechou o LoL 😤";
      stage.classList.remove("running");
      stage.classList.add("crashed");
      heat(1);
      fx.shake(stage);
      if (!cashed) {
        msg.textContent = `Deu tilt a ${fmtX(point)}. Perdeste ${fmt.format(stake)} moedas.`;
        setStreak(false);
      }
      addHistory(hist, fmtX(point), point >= 2 ? "hi" : "lo");
      btn.disabled = false;
      btn.textContent = "Jogar outra vez";
      autoInput.disabled = false;
      lockTabs(false);
    }

    btn.addEventListener("click", () => (running ? cashOut(multAt(performance.now() - start)) : play()));
    window.addEventListener("resize", resize);

    return { resize };
  })();
})();
