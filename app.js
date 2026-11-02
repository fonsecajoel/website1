(function () {
  const config = window.PECUNIA;
  const channel = config.channel;
  const GQL = "https://gql.twitch.tv/gql";
  const CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
  const IVR = "https://api.ivr.fi/v2/twitch/user?login=" + encodeURIComponent(channel);

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const badge = $("[data-live-badge]");
  const badgeText = $("[data-live-text]");
  const chip = $("[data-chip]");
  const chipText = $("[data-chip-text]");
  const stage = $("[data-stage]");
  const summary = $("[data-summary]");
  const detail = $("[data-detail]");
  const lastTitle = $("[data-last-title]");
  const meta = $("[data-meta]");
  const updated = $("[data-updated]");
  const playerSlot = $("[data-player]");
  const chatSlot = $("[data-chat]");
  const modal = $("[data-modal]");
  const modalFrame = $("[data-modal-frame]");

  let isLive = false;
  let embedsMounted = false;

  const fmtNum = new Intl.NumberFormat("pt-PT");
  const fmtDate = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short", year: "numeric" });
  const fmtWhen = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" });

  function parentParams() {
    const hosts = new Set([location.hostname || "localhost", "localhost", "127.0.0.1"]);
    return Array.from(hosts).map((h) => "parent=" + encodeURIComponent(h)).join("&");
  }

  function iframe(src, title) {
    const el = document.createElement("iframe");
    el.src = src;
    el.title = title;
    el.allow = "autoplay; fullscreen";
    el.allowFullscreen = true;
    return el;
  }

  function liveSrc(muted) {
    return "https://player.twitch.tv/?channel=" + channel + "&autoplay=true&muted=" + muted + "&" + parentParams();
  }

  function relative(iso) {
    const then = new Date(iso).getTime();
    if (!iso || Number.isNaN(then)) return "";
    const min = Math.round((Date.now() - then) / 60000);
    if (min < 1) return "agora mesmo";
    if (min < 60) return "há " + min + " min";
    const h = Math.round(min / 60);
    if (h < 24) return "há " + h + (h === 1 ? " hora" : " horas");
    const d = Math.round(h / 24);
    if (d < 30) return "há " + d + (d === 1 ? " dia" : " dias");
    const m = Math.round(d / 30);
    return "há " + m + (m === 1 ? " mês" : " meses");
  }

  function duration(sec) {
    const s = Math.round(sec || 0);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function setLiveUI(live, viewers) {
    isLive = live;
    document.body.classList.toggle("is-live", live);
    badge.classList.toggle("is-live", live);
    chip.classList.toggle("is-live", live);
    stage.classList.toggle("is-live", live);
    badgeText.textContent = live ? "Em direto" : "Direto";
    chipText.textContent = live
      ? "Em direto" + (viewers != null ? " · " + fmtNum.format(viewers) : "")
      : "Offline";
    document.title = (live ? "🔴 EM DIRETO · " : "") + "Pecúnia · Streamer de League of Legends";
  }

  function mountEmbeds() {
    if (embedsMounted) return;
    embedsMounted = true;
    playerSlot.appendChild(iframe(liveSrc(true), "Live da Pecúnia na Twitch"));
    chatSlot.appendChild(iframe("https://www.twitch.tv/embed/" + channel + "/chat?" + parentParams(), "Chat da Twitch"));
  }

  function setFollowers(n) {
    if (typeof n !== "number") return;
    $$("[data-followers]").forEach((el) => { el.textContent = fmtNum.format(n); });
  }

  function render(data) {
    setFollowers(data.followers);
    if (data.stream) {
      setLiveUI(true, data.stream.viewers);
      mountEmbeds();
      const bits = [data.stream.game, data.stream.viewers != null ? fmtNum.format(data.stream.viewers) + " a ver" : "", "começou " + relative(data.stream.startedAt)].filter(Boolean);
      summary.textContent = "Estou em direto agora: " + (data.stream.title || "vem ao chat!") + " — " + bits.join(" · ");
    } else {
      setLiveUI(false);
      const last = data.lastBroadcast;
      summary.textContent = last && last.startedAt
        ? "Agora estou offline. A última live foi " + relative(last.startedAt) + "."
        : "Agora estou offline.";
      detail.textContent = "Última live";
      lastTitle.textContent = (last && last.title) || "Pecunia World";
      meta.textContent = last && last.startedAt ? fmtWhen.format(new Date(last.startedAt)) : "";
    }
    updated.textContent = "Atualizado às " + new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  }

  function renderClips(clips) {
    if (!clips || !clips.length) return;
    const list = $("[data-clips]");
    list.innerHTML = "";
    clips.slice(0, 4).forEach((c) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className = "clip";
      btn.type = "button";
      btn.dataset.clip = c.slug;
      btn.innerHTML =
        '<span class="thumb"><img loading="lazy" alt=""><span class="dur"></span></span><strong></strong><small></small>';
      btn.querySelector("img").src = c.thumbnailURL;
      btn.querySelector(".dur").textContent = duration(c.durationSeconds);
      btn.querySelector("strong").textContent = c.title;
      btn.querySelector("small").textContent = fmtNum.format(c.viewCount) + " visualizações · " + fmtDate.format(new Date(c.createdAt));
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  async function fromGql() {
    const query = 'query{user(login:"' + channel + '"){followers{totalCount} lastBroadcast{title startedAt} stream{title viewersCount createdAt game{displayName}} clips(first:4,criteria:{period:ALL_TIME,sort:VIEWS_DESC}){edges{node{slug title viewCount durationSeconds createdAt thumbnailURL(width:480,height:272)}}}}}';
    const res = await fetch(GQL, { method: "POST", headers: { "Client-Id": CLIENT_ID }, body: JSON.stringify({ query }) });
    if (!res.ok) throw new Error("gql " + res.status);
    const json = await res.json();
    const u = json && json.data && json.data.user;
    if (!u) throw new Error("gql empty");
    return {
      followers: u.followers && u.followers.totalCount,
      lastBroadcast: u.lastBroadcast,
      stream: u.stream && {
        title: u.stream.title,
        viewers: u.stream.viewersCount,
        startedAt: u.stream.createdAt,
        game: u.stream.game && u.stream.game.displayName,
      },
      clips: ((u.clips && u.clips.edges) || []).map((e) => e.node),
    };
  }

  async function fromIvr() {
    const res = await fetch(IVR, { cache: "no-store" });
    if (!res.ok) throw new Error("ivr " + res.status);
    const u = (await res.json())[0];
    const s = u.stream;
    return {
      followers: u.followers,
      lastBroadcast: u.lastBroadcast,
      stream: s && {
        title: s.title,
        viewers: s.viewersCount ?? s.viewers,
        startedAt: s.createdAt || s.startedAt,
        game: s.game && (s.game.displayName || s.game.name),
      },
    };
  }

  let clipsLoaded = false;
  async function refresh() {
    if (document.hidden) return;
    try {
      const data = await fromGql().catch(fromIvr);
      render(data);
      if (!clipsLoaded && data.clips) {
        renderClips(data.clips);
        clipsLoaded = true;
      }
    } catch (e) {
      summary.textContent = "Não consegui falar com a Twitch agora. O canal está em twitch.tv/" + channel + ".";
      chipText.textContent = "Twitch";
    }
  }

  function openModal(src, title) {
    modalFrame.innerHTML = "";
    modalFrame.appendChild(iframe(src, title));
    if (typeof modal.showModal === "function") modal.showModal();
    else window.open(src, "_blank", "noopener");
  }

  function closeModal() {
    modal.close();
    modalFrame.innerHTML = "";
  }

  $("[data-close]").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  modal.addEventListener("close", () => { modalFrame.innerHTML = ""; });

  $("[data-play]").addEventListener("click", (e) => {
    e.stopPropagation();
    if (isLive) openModal(liveSrc(false), "Live da Pecúnia");
    else document.getElementById("live").scrollIntoView({ behavior: "smooth" });
  });

  $("[data-clips]").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-clip]");
    if (!btn) return;
    openModal("https://clips.twitch.tv/embed?clip=" + encodeURIComponent(btn.dataset.clip) + "&autoplay=true&" + parentParams(), "Clip da Pecúnia");
  });

  // hearts
  const heartBtn = $("[data-heart]");
  const heartCount = $("[data-heart-count]");
  let hearts = Number(localStorage.getItem("pecunia-hearts") || 0);
  heartCount.textContent = fmtNum.format(hearts);
  function sendHeart(x, y, host) {
    hearts += 1;
    localStorage.setItem("pecunia-hearts", String(hearts));
    heartCount.textContent = fmtNum.format(hearts);
    heartBtn.classList.remove("pop");
    void heartBtn.offsetWidth;
    heartBtn.classList.add("pop");
    const b = document.createElement("span");
    b.className = "burst";
    b.textContent = "♥";
    b.style.left = x + "px";
    b.style.top = y + "px";
    b.style.setProperty("--dx", (Math.random() * 80 - 40) + "px");
    host.appendChild(b);
    setTimeout(() => b.remove(), 1000);
  }
  const photo = $(".photo");
  photo.addEventListener("click", (e) => {
    const r = photo.getBoundingClientRect();
    sendHeart(e.clientX - r.left - 10, e.clientY - r.top - 10, photo);
  });
  heartBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sendHeart(photo.clientWidth - 40, 40, photo);
  });

  // draggable stickers
  $$(".sticker").forEach((el) => {
    let sx = 0, sy = 0, ox = 0, oy = 0;
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      sx = e.clientX - ox;
      sy = e.clientY - oy;
    });
    el.addEventListener("pointermove", (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      ox = e.clientX - sx;
      oy = e.clientY - sy;
      el.style.translate = ox + "px " + oy + "px";
    });
  });

  // discord
  const invite = (config.discord || "").trim();
  if (invite) {
    $$("[data-discord]").forEach((a) => { a.href = invite; });
    const note = $("[data-discord-note]");
    if (note) note.textContent = "entra na comunidade";
  }

  const year = $("[data-year]");
  if (year) year.textContent = new Date().getFullYear();

  refresh();
  setInterval(refresh, 45000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
})();
