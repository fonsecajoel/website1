(function () {
  const config = window.PECUNIA;
  const channel = config.channel;
  const statusUrl = "https://api.ivr.fi/v2/twitch/user?login=" + encodeURIComponent(channel);

  const liveBadge = document.querySelector("[data-live-badge]");
  const liveText = document.querySelector("[data-live-text]");
  const summary = document.querySelector("[data-summary]");
  const detail = document.querySelector("[data-detail]");
  const meta = document.querySelector("[data-meta]");
  const followers = document.querySelector("[data-followers]");
  const updated = document.querySelector("[data-updated]");
  const stage = document.querySelector("[data-stage]");
  const playerSlot = document.querySelector("[data-player]");
  const chatSlot = document.querySelector("[data-chat]");
  const discordNote = document.querySelector("[data-discord-note]");

  let playerReady = false;
  let wasLive = null;

  function parents() {
    const host = location.hostname || "localhost";
    return Array.from(new Set([host, "localhost", "127.0.0.1"]));
  }

  function embedSrc(kind) {
    const base = kind === "chat"
      ? "https://www.twitch.tv/embed/" + channel + "/chat"
      : "https://player.twitch.tv/";
    const params = new URLSearchParams();
    if (kind === "player") {
      params.set("channel", channel);
      params.set("muted", "true");
      params.set("autoplay", "true");
    } else {
      params.set("darkpopout", "");
    }
    parents().forEach(function (parent) {
      params.append("parent", parent);
    });
    return base + "?" + params.toString();
  }

  function mountEmbeds() {
    if (playerReady) return;
    playerReady = true;
    playerSlot.innerHTML = "";
    chatSlot.innerHTML = "";

    const player = document.createElement("iframe");
    player.src = embedSrc("player");
    player.title = "Player da Twitch de " + config.name;
    player.allowFullscreen = true;
    player.allow = "autoplay; fullscreen";
    playerSlot.appendChild(player);

    const chat = document.createElement("iframe");
    chat.src = embedSrc("chat");
    chat.title = "Chat da Twitch de " + config.name;
    chatSlot.appendChild(chat);
  }

  function gameName(stream) {
    if (!stream || stream.game == null) return "";
    if (typeof stream.game === "string") return stream.game;
    return stream.game.displayName || stream.game.name || "";
  }

  function viewerCount(stream) {
    if (!stream) return null;
    const value = stream.viewersCount ?? stream.viewers ?? stream.viewerCount;
    return typeof value === "number" ? value : null;
  }

  function formatWhen(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("pt-PT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Lisbon",
    }).format(date);
  }

  function relative(iso) {
    if (!iso) return "";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const minutes = Math.round((Date.now() - then) / 60000);
    if (minutes < 1) return "agora mesmo";
    if (minutes < 60) return "há " + minutes + " min";
    const hours = Math.round(minutes / 60);
    if (hours < 24) return "há " + hours + (hours === 1 ? " hora" : " horas");
    const days = Math.round(hours / 24);
    if (days < 30) return "há " + days + (days === 1 ? " dia" : " dias");
    const months = Math.round(days / 30);
    return "há " + months + (months === 1 ? " mês" : " meses");
  }

  function setBadge(live) {
    liveBadge.classList.toggle("is-live", live);
    liveBadge.classList.toggle("is-offline", !live);
    document.body.classList.toggle("is-live", live);
    liveText.textContent = live ? "Ao vivo" : "Offline";
  }

  function render(user) {
    const stream = user && user.stream;
    const live = Boolean(stream);
    setBadge(live);
    document.title = (live ? "AO VIVO · " : "") + "PecuniaLoL — lives, Instagram e Discord";
    stage.classList.toggle("is-live", live);

    if (typeof user.followers === "number") {
      followers.textContent = new Intl.NumberFormat("pt-PT").format(user.followers);
    }

    if (live) {
      mountEmbeds();
      const game = gameName(stream);
      const viewers = viewerCount(stream);
      summary.textContent = stream.title || "Estou live";
      const bits = ["Começou " + (relative(stream.startedAt) || "agora")];
      if (game) bits.unshift(game);
      if (viewers != null) bits.push(viewers + (viewers === 1 ? " espetador" : " espetadores"));
      detail.textContent = bits.join(" · ");
      meta.textContent = formatWhen(stream.startedAt);
    } else {
      const last = user && user.lastBroadcast;
      summary.textContent = "Estou offline";
      if (last && last.title) {
        detail.textContent = "A última live foi “" + last.title + "”, " + (relative(last.startedAt) || "há pouco") + ".";
      } else {
        detail.textContent = "Assim que eu abrir a stream, esta página muda sozinha.";
      }
      meta.textContent = last && last.startedAt ? formatWhen(last.startedAt) : "Twitch · " + config.name;
    }

    updated.textContent = "Atualizado às " + new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Lisbon",
    }).format(new Date());

    if (wasLive === false && live) {
      updated.textContent = "Acabei de entrar em live.";
    }
    wasLive = live;
  }

  function renderError() {
    setBadge(false);
    summary.textContent = "Não consegui confirmar a Twitch agora.";
    detail.textContent = "O canal continua em twitch.tv/" + channel + ". Tenta atualizar daqui a pouco.";
    meta.textContent = "Ligação à Twitch indisponível";
  }

  async function refresh() {
    if (document.hidden) return;
    try {
      const response = await fetch(statusUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("status " + response.status);
      const data = await response.json();
      const user = Array.isArray(data) ? data[0] : data;
      if (!user || !user.login) throw new Error("empty");
      render(user);
    } catch (error) {
      renderError();
    }
  }

  function setupDiscord() {
    const invite = (config.discord || "").trim();
    if (!invite) return;
    document.querySelectorAll("[data-discord]").forEach(function (link) {
      link.href = invite;
      const label = link.querySelector(".go");
      if (label) label.textContent = "Entrar no Discord";
      else link.textContent = "Entrar no Discord";
    });
    if (discordNote) {
      discordNote.textContent = "Combina jogos, pede aviso de live e fica depois do stream.";
    }
  }

  setupDiscord();
  refresh();
  setInterval(refresh, 45000);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh();
  });
})();
