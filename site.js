(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const journey = byId("journey");
  const stage = byId("stage");
  const gallery = byId("still-sequence");
  const motionButton = byId("motion");
  const header = document.querySelector(".masthead");
  const startStill = byId("frame-front");
  const endStill = byId("frame-finish");
  const closingMessage = byId("closing-message");
  const pillar = byId("pillar");
  const title = byId("look-title");
  const showTitle = byId("still-title");
  const stageHeading = byId("stage-heading");
  const indexLabel = byId("look-index");
  const callouts = byId("callouts");
  const imageStage = byId("image-stage");
  const dust = byId("dust");
  const stageFooter = stage.querySelector(".stage-footer");
  const styleControls = [...callouts.querySelectorAll(".callout")].map((element) => ({
    element,
    link: element.querySelector("a"),
    label: element.querySelector(".style-name"),
    logo: element.querySelector(".style-mark"),
  }));
  const viewLabel = byId("view-label");
  const tracker = byId("tracker-fill");
  const orbitButton = byId("orbit");
  const orbitLabel = byId("orbit-label");
  const jumps = [...document.querySelectorAll("[data-jump]")];
  const videoContainer = byId("videos");
  const merchandise = byId("merchandise");
  const collectionNav = merchandise.querySelector(".collection-nav");
  const collectionLinks = [...collectionNav.querySelectorAll("a")];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  // The still version covers very short screens (phones held sideways); data saver starts there too.
  const smallViewport = matchMedia("(max-height: 470px), (max-width: 760px) and (max-height: 560px)");
  const containFit = matchMedia("(min-aspect-ratio: 2/1)");
  const saveData = navigator.connection?.saveData === true;
  const config = window.fu7ureVideos || {};
  const FPS = 24;
  const RATIO = 16 / 9;
  const PILLAR_CROSS = 0.16;   // share of a duet the pillar takes to cross the lens, either side of a hand-over
  const PILLAR_HOLD = 0.03;    // share either side of the hand-over where the lens stays fully covered

  // Scroll per duet can be tried out on a preview with ?step=70 (screen heights × 100).
  const stepParam = Number(new URLSearchParams(location.search).get("step"));
  if (stepParam >= 40 && stepParam <= 160) document.documentElement.style.setProperty("--step", stepParam + "vh");

  // Per clip: which part of the duet's scroll each clip covers, when the labels show (front views only),
  // and where each dancer's chest is, read from the footage. Keys: [clip share, left x, y, right x, y].
  const sceneDesigns = {
    "r2-sasha": {
      brands: [{ name: "R2", logo: "r2-pin-stack-r1.svg" }, { name: "MOLOT", logo: "molot-coupler-r1.svg" }],
      clip: (t) => clamp((t - 0.02) / 0.98),
      labels: [0, 0.25],
      keys: [[0, .43, .35, .54, .34], [.097, .43, .35, .56, .34], [.193, .45, .35, .57, .34], [.29, .45, .35, .54, .34]],
      views: [[0.25, "FRONT VIEW"], [0.62, "SIDE VIEW"], [1, "REAR VIEW"]],
    },
    "tsubasa-qu4nt": {
      brands: [{ name: "H4J1ME", logo: "h4j1me-pole-position-r1.svg" }, { name: "8888", logo: "8888-faction-01-wordmark.svg" }],
      clip: (t) => t,
      labels: [0.14, 0.36],
      keys: [[0, .39, .36, .60, .34], [.104, .38, .36, .58, .34], [.207, .37, .36, .56, .34], [.311, .40, .36, .57, .34]],
      views: [[0.36, "FRONT VIEW"], [0.62, "SIDE VIEW"], [1, "REAR VIEW"]],
    },
    "v3sp3r-l0wk3y": {
      brands: [{ name: "R4V3NS", logo: "r4v3ns-faction-03-v8-wordmark.svg" }, { name: "ROLL3RZ", logo: "roll3rz-double-link-r1.svg" }],
      clip: (t) => clamp(t / 0.82),
      closing: 0.82,
      labels: [0.64, 1],
      keys: [[.694, .43, .35, .59, .35], [.826, .44, .35, .56, .35], [.926, .44, .35, .55, .35], [.992, .43, .35, .55, .35]],
      views: [[0.6, "SIDE VIEW"], [1, "FRONT VIEW"]],
    },
  };

  const scenes = [...gallery.querySelectorAll(".still-look")].map((article) => ({
    article,
    design: sceneDesigns[article.id],
    title: article.querySelector("h2").textContent,
    styles: [...article.querySelectorAll(".style-legend div")].map((item) => ({
      name: item.querySelector("dt a").firstChild.textContent.trim(),
      href: item.querySelector("dt a").getAttribute("href"),
      tone: item.dataset.tone,
    })),
    startSrc: article.querySelector("[data-start] img")?.getAttribute("src") || "",
    endSrc: article.querySelector("[data-end] img")?.getAttribute("src") || "",
    videoPath: config[article.id],
    loading: null,
    video: null,
    frames: 0,
    requested: -1,
    decoded: -1,
    wanted: 0,
    shown: false,
  }));
  const last = scenes.length - 1;
  // Load every maker mark up front, so a label never shows the previous duet's maker while its mark swaps.
  for (const { design } of scenes) for (const brand of design.brands) new Image().src = "media/marks/" + brand.logo;
  let manualMotion;
  let motionOn = false;
  let currentScene = -1;
  let currentProgress = 0;
  let modeInitialized = false;
  let frameRequest = 0;
  let onScreen = true;
  let target = 0;
  let position = 0;
  let velocity = 0;
  let lastTime = 0;
  let snap = "hard";
  let wipe = null;
  let focus = 0.5;
  const WIPE_MS = 700;

  function clamp(value, low = 0, high = 1) { return Math.min(high, Math.max(low, value)); }
  const ease = (value) => {
    const t = clamp(value);
    return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  const lerp = (from, to, amount) => from + (to - from) * amount;

  function scrollRange() {
    const { top, height } = journey.getBoundingClientRect();
    return {
      start: top + scrollY - header.offsetHeight,
      distance: Math.max(1, height - stage.offsetHeight),
    };
  }

  // A jump to another duet passes behind the pillar; a jump within the same duet glides there.
  function jumpTo(index, progress = 0, how = "wipe") {
    const { start, distance } = scrollRange();
    if (how === "hard" || index !== currentScene) snap = how;
    scrollTo({ top: start + distance * (index + progress) / scenes.length, behavior: "instant" });
    schedule();
  }

  function setStill(image, source) {
    if (!source) { image.hidden = true; image.removeAttribute("src"); return; }
    if (image.getAttribute("src") !== source) image.src = source;
    image.hidden = false;
  }

  function selectScene(index) {
    const scene = scenes[index];
    currentScene = index;
    scene.shown = false;
    setStill(startStill, scene.startSrc);
    setStill(endStill, scene.endSrc);
    stage.style.setProperty("--scene-image", scene.startSrc ? 'url("' + scene.startSrc + '")' : "none");
    title.textContent = scene.title;
    styleControls.forEach(({ element, link, label, logo }, styleIndex) => {
      const style = scene.styles[styleIndex];
      element.dataset.tone = style.tone;
      label.textContent = style.name;
      const mark = scene.design.brands[styleIndex];
      logo.src = "media/marks/" + mark.logo;
      logo.alt = mark.name;
      logo.title = mark.name;
      link.href = style.href;
    });
    indexLabel.textContent = String(index + 1).padStart(2, "0") + " / " + String(scenes.length).padStart(2, "0");
    jumps.forEach((button, buttonIndex) => {
      if (index === buttonIndex) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    loadClip(scene);
  }

  // Each clip is downloaded whole before it is shown, so scrubbing never waits on the network,
  // then the next nearest clip starts. If a host refuses, the clip streams from its URL instead.
  function loadClip(scene) {
    if (!scene?.videoPath || scene.loading) return;
    scene.loading = fetch(scene.videoPath, { mode: "cors", credentials: "omit" })
      .then(async (response) => {
        if (!response.ok || !response.body) throw new Error("clip " + response.status);
        const total = Number(response.headers.get("content-length")) || 0;
        const reader = response.body.getReader();
        const parts = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value);
          received += value.length;
          scene.loaded = total ? received / total : 0;
          if (scene === scenes[currentScene]) schedule();
        }
        return URL.createObjectURL(new Blob(parts, { type: "video/mp4" }));
      })
      .catch(() => scene.videoPath)
      .then((source) => {
        attachVideo(scene, source);
        const next = scenes.filter((item) => !item.loading && item.videoPath)
          .sort((a, b) => Math.abs(scenes.indexOf(a) - currentScene) - Math.abs(scenes.indexOf(b) - currentScene))[0];
        if (next) loadClip(next);
      });
  }

  function attachVideo(scene, source) {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.disablePictureInPicture = true;
    video.tabIndex = -1;
    video.dataset.scene = scene.article.id;
    scene.video = video;
    video.addEventListener("loadedmetadata", () => { scene.frames = Math.max(1, Math.round(video.duration * FPS)); schedule(); });
    video.addEventListener("loadeddata", () => {
      if (scene.decoded < 0) scene.decoded = Math.round(video.currentTime * FPS - .5);
      // Some phone browsers only draw a video's frames once it has played: a muted play and pause wakes it up.
      video.play().then(() => { video.pause(); scene.requested = -1; schedule(); }).catch(() => {});
      schedule();
    }, { once: true });
    video.addEventListener("seeked", () => { scene.decoded = scene.requested; schedule(); });
    video.src = source;
    videoContainer.append(video);
  }

  // Every clip has a keyframe on every frame, so any frame decodes on its own in either direction.
  function seek(scene, share) {
    const { video } = scene;
    if (!video || video.error || video.readyState < HTMLMediaElement.HAVE_METADATA || !scene.frames) return;
    const frame = Math.round(clamp(share) * (scene.frames - 1));
    scene.wanted = frame;
    if (!video.seeking && frame !== scene.requested) {
      scene.requested = frame;
      video.currentTime = (frame + .5) / FPS;
    }
  }

  // The steel column crosses right to left, the way the camera travels, and stays fully closed around each hand-over.
  function pillarOffset(position) {
    for (let boundary = 1; boundary <= last; boundary++) {
      const d = position - boundary;
      if (d <= -PILLAR_CROSS || d >= PILLAR_CROSS) continue;
      if (d < -PILLAR_HOLD) return 101 * (1 - ease((d + PILLAR_CROSS) / (PILLAR_CROSS - PILLAR_HOLD)));
      if (d <= PILLAR_HOLD) return 0;
      return -101 * ease((d - PILLAR_HOLD) / (PILLAR_CROSS - PILLAR_HOLD));
    }
    return 101;
  }

  function keyPoints(keys, share) {
    let from = keys[0];
    let to = keys[0];
    if (share >= keys[keys.length - 1][0]) from = to = keys[keys.length - 1];
    else for (let k = 0; k < keys.length - 1; k++) {
      if (share >= keys[k][0] && share <= keys[k + 1][0]) { from = keys[k]; to = keys[k + 1]; break; }
    }
    const s = to[0] > from[0] ? clamp((share - from[0]) / (to[0] - from[0])) : 0;
    return [[lerp(from[1], to[1], s), lerp(from[2], to[2], s)], [lerp(from[3], to[3], s), lerp(from[4], to[4], s)]];
  }

  function followCast(points, scale, panX) {
    const stageBox = stage.getBoundingClientRect();
    const imageBox = imageStage.getBoundingClientRect();
    const boxWidth = imageBox.width;
    const boxHeight = imageBox.height;
    const height = containFit.matches ? Math.min(boxHeight, boxWidth / RATIO) : Math.max(boxHeight, boxWidth / RATIO);
    const width = height * RATIO;
    // On narrow screens the film is wider than the box: pan it to keep the pair in view.
    const overflow = boxWidth - width;
    let share = .5;
    if (overflow < -.5) {
      const visible = boxWidth / width;
      const centre = clamp(focus, visible / 2, 1 - visible / 2);
      share = clamp((boxWidth / 2 - centre * width) / overflow);
    }
    imageStage.style.setProperty("--focus-x", (share * 100).toFixed(2) + "%");
    const left0 = overflow * share;
    const top0 = (boxHeight - height) / 2;
    const noMargin = stageBox.width < 600;
    const margin = noMargin ? 12 : Math.max(16, stageBox.width * .023);
    const gap = noMargin ? 9 : 17;
    const limitY = stageFooter.offsetTop - 8;
    const within = (value, low, high) => Math.max(low, Math.min(value, high));
    const offsets = points.map(([u, v], index) => ({
      x: within(imageBox.left - stageBox.left + boxWidth / 2 + (left0 + u * width - boxWidth / 2) * scale + panX, margin, stageBox.width - margin),
      y: within(imageBox.top - stageBox.top + boxHeight / 2 + (top0 + v * height - boxHeight / 2) * scale, margin, limitY),
      control: styleControls[index],
    })).sort((a, b) => a.x - b.x);

    offsets.forEach((offset, index) => {
      const { link } = offset.control;
      offset.w = link.offsetWidth;
      offset.h = link.offsetHeight;
      const preferred = index === 0 ? offset.x - offset.w - gap : offset.x + gap;
      offset.left = within(preferred, margin, stageBox.width - margin - offset.w);
      const docked = noMargin || Math.abs(preferred - offset.left) > 10;
      const top = docked ? offset.y + Math.max(offset.h + 10, imageBox.height * .17) : offset.y - offset.h / 2;
      offset.top = within(top, margin, limitY - offset.h);
    });

    const [left, right] = offsets;
    if (left.left + left.w + gap > right.left && Math.abs(left.top - right.top) < Math.max(left.h, right.h)) {
      left.left = Math.max(margin, right.left - left.w - gap);
      if (left.left + left.w + gap > right.left) {
        left.top = within(right.top - left.h - gap, margin, limitY - left.h);
      }
    }

    offsets.forEach(({ control, x, y, left, top, w, h }) => {
      const dx = within(x, left, left + w) - x;
      const dy = within(y, top, top + h) - y;
      const style = control.element.style;
      style.setProperty("--pin-x", x + "px");
      style.setProperty("--pin-y", y + "px");
      style.setProperty("--label-x", left + "px");
      style.setProperty("--label-y", top + "px");
      style.setProperty("--leader-width", Math.hypot(dx, dy) + "px");
      style.setProperty("--leader-angle", Math.atan2(dy, dx) + "rad");
    });
  }

  // Dust in the light drifts against the camera's movement, which adds depth to the footage.
  const dustContext = dust.getContext("2d");
  const motes = Array.from({ length: 70 }, () => {
    const z = .25 + Math.random() * .75;
    return { x: Math.random(), y: Math.random(), z, rise: (.004 + Math.random() * .01) * z, alpha: .08 + Math.random() * .34, phase: Math.random() * 6.28, spark: Math.random() < .2 };
  });
  function sizeDust() {
    const ratio = Math.min(2, devicePixelRatio || 1);
    dust.width = Math.round(dust.clientWidth * ratio);
    dust.height = Math.round(dust.clientHeight * ratio);
  }
  function drawDust(dt) {
    const { width, height } = dust;
    if (!width || !height) return;
    dustContext.clearRect(0, 0, width, height);
    for (const mote of motes) {
      mote.phase += dt * 1.2;
      mote.y -= mote.rise * dt;
      mote.x += (-velocity * .9 * mote.z * mote.z + Math.sin(mote.phase) * .004) * dt;
      if (mote.x < -.03) mote.x += 1.06;
      if (mote.x > 1.03) mote.x -= 1.06;
      if (mote.y < -.02) { mote.y = 1.02; mote.x = Math.random(); }
      const radius = (mote.spark ? 1.1 : 1.8) * mote.z * (width / 1100 + .5);
      const alpha = mote.alpha * (.6 + .4 * Math.sin(mote.phase * 1.7));
      dustContext.beginPath();
      dustContext.fillStyle = mote.spark ? "rgba(255,214,150," + alpha + ")" : "rgba(245,180,95," + alpha * .5 + ")";
      dustContext.arc(mote.x * width, mote.y * height, radius, 0, 6.283);
      dustContext.fill();
    }
  }

  function render(dt, show, pillarOverride) {
    const index = Math.min(last, Math.floor(show));
    const progress = clamp(show - index);
    const scene = scenes[index];
    if (index !== currentScene) selectScene(index);
    currentProgress = progress;
    const share = scene.design.clip(progress);

    // The current clip follows the scroll; its neighbours wait behind the pillar on the frame they will be revealed on.
    seek(scene, share);
    const next = scenes[index + 1];
    const previous = scenes[index - 1];
    if (next?.video && show > index + 1 - PILLAR_CROSS) seek(next, next.design.clip(0));
    if (previous?.video && show < index + PILLAR_CROSS) seek(previous, previous.design.clip(1));

    // A clip shows once it has decoded a frame near the wanted one; after that it stays up even if it trails a fast scroll.
    const video = scene.video;
    const ready = video && !video.error && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    if (!scene.shown && ready && (!scene.startSrc || Math.abs(scene.decoded - scene.wanted) <= 30)) {
      scene.shown = true;
      // The still underneath is a separate picture of the same moment, so the clip fades in over it
      // when it first arrives in view; behind the pillar the swap stays instant.
      const inView = Math.abs(pillarOverride ?? pillarOffset(show)) > 99;
      video.style.transition = inView ? "opacity .35s ease" : "none";
      if (inView) setTimeout(() => { video.style.transition = "none"; }, 400);
    }
    scenes.forEach((item) => {
      if (item.video) item.video.style.opacity = item === scene && scene.shown ? "1" : "0";
    });
    endStill.style.opacity = share > .5 ? "1" : "0";
    const pictured = scene.shown || (!startStill.hidden && startStill.complete && startStill.naturalWidth > 0);
    stage.toggleAttribute("data-loading", !scene.shown);
    stage.style.setProperty("--load", String(scene.loaded || 0));

    const offset = pillarOverride ?? pillarOffset(show);
    pillar.style.transform = "translateX(" + offset.toFixed(2) + "%)";
    pillar.style.setProperty("--smear", (1 + Math.min(1.5, Math.abs(velocity) * 1.2)).toFixed(2));

    // Closing: the last pair slides right and the camera leans in, which clears the left for the wordmark.
    const push = scene.design.closing ? ease((progress - scene.design.closing) / (1 - scene.design.closing)) : 0;
    const wide = stage.clientWidth / stage.clientHeight > 1.25;
    const scale = 1 + (wide ? .12 : .05) * push;
    const panX = (wide ? .06 : 0) * imageStage.clientWidth * push;
    imageStage.style.setProperty("--film-scale", scale.toFixed(4));
    imageStage.style.setProperty("--film-x", panX.toFixed(1) + "px");
    const closingOpacity = index === last ? ease((progress - .86) / .1) : 0;
    closingMessage.hidden = closingOpacity === 0;
    closingMessage.style.opacity = String(closingOpacity);
    stage.toggleAttribute("data-closing", closingOpacity > 0);

    // Labels: only while the duet faces the camera, and never while the pillar is in front of the lens.
    const points = keyPoints(scene.design.keys, share);
    const [from, to] = scene.design.labels;
    const facing = clamp(1 - (from - share) / .03) * clamp(1 - (share - to) / .03);
    const labelOpacity = pictured ? facing * clamp((Math.abs(offset) - 55) / 25) : 0;
    callouts.style.setProperty("--callout-opacity", labelOpacity.toFixed(3));
    callouts.inert = labelOpacity < .05;
    const focusTarget = facing > 0 ? (points[0][0] + points[1][0]) / 2 : .5;
    focus += (focusTarget - focus) * Math.min(1, dt * 4);
    followCast(points, scale, panX);

    tracker.style.transform = "scaleX(" + (show / scenes.length) + ")";
    viewLabel.textContent = closingOpacity > .5 ? "CLOSING VIEW" : (scene.design.views.find(([end]) => share <= end) || [0, ""])[1];
    orbitLabel.textContent = show < .03 ? "Scroll to explore" : index < last ? "Next styles" : progress < .9 ? "Closing view" : "Back to start";
    if (onScreen) drawDust(dt);
  }

  // The camera follows the scroll on a spring: it speeds up toward where you scrolled, then settles.
  // Long jumps (chapter buttons, the scrollbar, the End key) pass behind the pillar instead of racing through the footage.
  function tick(now) {
    frameRequest = 0;
    if (!motionOn) return;
    const dt = lastTime ? Math.min(.3, (now - lastTime) / 1000) : 0;
    lastTime = now;
    const { start, distance } = scrollRange();
    target = clamp((scrollY - start) / distance) * scenes.length;
    const targetScene = Math.min(last, Math.floor(target));
    if (snap === "hard" || (snap && currentScene < 0)) {
      position = target;
      velocity = 0;
      wipe = null;
    } else if (!wipe && currentScene >= 0 && targetScene !== currentScene && (snap === "wipe" || Math.abs(target - position) > 1.2)) {
      wipe = { start: now, direction: target > position ? 1 : -1, swapped: false };
    }
    snap = false;

    let show = position;
    let pillarOverride = null;
    if (wipe) {
      const k = (now - wipe.start) / WIPE_MS;
      if (k >= .5 && !wipe.swapped) { position = target; velocity = 0; wipe.swapped = true; }
      show = position;
      const enter = 101 * (1 - ease(k / .42));
      const leave = -101 * ease((k - .58) / .42);
      pillarOverride = (k < .42 ? enter : k < .58 ? 0 : leave) * wipe.direction;
      if (k >= 1) wipe = null;
    } else {
      const before = position;
      const stiffness = 46;
      const damping = 2 * Math.sqrt(stiffness);
      for (let remaining = dt; remaining > 1e-5;) {
        const h = Math.min(.012, remaining);
        velocity += (stiffness * (target - position) - damping * velocity) * h;
        position += velocity * h;
        remaining -= h;
      }
      position = clamp(position, 0, scenes.length);
      // Never let one frame skip the closed pillar: draw the hand-over itself first.
      const boundary = position > before ? Math.floor(position) : Math.floor(before);
      if (Math.floor(before) !== Math.floor(position) && boundary >= 1 && boundary <= last) {
        show = boundary + (position > before ? 1e-4 : -1e-4);
      } else show = position;
    }
    render(dt, clamp(show, 0, scenes.length), pillarOverride);
    const settled = !wipe && Math.abs(target - position) < 1e-4 && Math.abs(velocity) < 1e-4;
    if (!settled || onScreen) frameRequest = requestAnimationFrame(tick);
    else lastTime = 0;
  }

  function schedule() {
    if (!motionOn || frameRequest) return;
    frameRequest = requestAnimationFrame(tick);
  }

  function closestGalleryScene() {
    const probe = header.offsetHeight + innerHeight * 0.25;
    return scenes.reduce((closest, scene, index) =>
      scene.article.getBoundingClientRect().top <= probe ? index : closest, 0);
  }

  function syncMode() {
    const wasOn = motionOn;
    const anchor = byId(location.hash.slice(1));
    const destination = anchor?.closest("[data-after-film]");
    const keepSection = destination &&
      (!modeInitialized || destination.getBoundingClientRect().top <= header.offsetHeight + 12);
    const resumeIndex = wasOn ? Math.max(0, currentScene) : closestGalleryScene();
    motionOn = !smallViewport.matches && (manualMotion ?? (!reducedMotion.matches && !saveData));
    motionButton.hidden = smallViewport.matches;
    motionButton.setAttribute("aria-pressed", String(motionOn));
    document.documentElement.toggleAttribute("data-scroll-motion", motionOn);
    journey.hidden = !motionOn;
    gallery.hidden = motionOn;
    // One h1: it sits in the stage while the Show moves, and heads the still version otherwise.
    if (motionOn) stageHeading.prepend(showTitle);
    else gallery.prepend(showTitle);

    if (keepSection) {
      if (!modeInitialized || motionOn !== wasOn) {
        requestAnimationFrame(() => anchor.scrollIntoView({ behavior: "instant" }));
      }
    } else if (motionOn && !wasOn) {
      const requested = scenes.findIndex(({ article }) => "#" + article.id === location.hash);
      jumpTo(requested >= 0 ? requested : resumeIndex, requested >= 0 || resumeIndex > 0 ? PILLAR_CROSS + .01 : 0, "hard");
    } else if (!motionOn && wasOn) {
      scenes[resumeIndex].article.scrollIntoView();
    }
    modeInitialized = true;
    snap = "hard";
    if (motionOn) sizeDust();
    schedule();
  }

  function markCollection() {
    const target = byId(location.hash.slice(1));
    const expandable = target?.closest(".product-expander");
    if (expandable && !expandable.open) {
      expandable.open = true;
      requestAnimationFrame(() => target.scrollIntoView({ behavior: "instant" }));
    }
    const parent = target?.closest(".collection");
    const activeHash = parent ? "#" + parent.id : location.hash;
    for (const link of collectionLinks) {
      if (link.getAttribute("href") === activeHash) {
        link.setAttribute("aria-current", "location");
        const navBounds = collectionNav.getBoundingClientRect();
        const linkBounds = link.getBoundingClientRect();
        if (linkBounds.left < navBounds.left) collectionNav.scrollLeft -= navBounds.left - linkBounds.left;
        else if (linkBounds.right > navBounds.right) collectionNav.scrollLeft += linkBounds.right - navBounds.right;
      } else {
        link.removeAttribute("aria-current");
      }
    }
  }
  addEventListener("hashchange", markCollection);
  merchandise.querySelector(".accessory-jump").addEventListener("click", () => {
    byId("track-accessories").closest(".product-expander").open = true;
  });

  // Chapter buttons land just after the pillar has cleared, on the duet's opening view.
  jumps.forEach((button, index) => button.addEventListener("click", () => jumpTo(index, index ? PILLAR_CROSS + .01 : 0)));
  orbitButton.addEventListener("click", () => {
    if (currentScene < last) jumpTo(currentScene + 1, PILLAR_CROSS + .01);
    else if (currentProgress < .9) jumpTo(last, 1);
    else jumpTo(0);
  });
  motionButton.hidden = false;
  motionButton.addEventListener("click", () => {
    manualMotion = !motionOn;
    syncMode();
  });
  reducedMotion.addEventListener("change", syncMode);
  smallViewport.addEventListener("change", syncMode);
  styleControls.forEach(({ logo }) => logo.addEventListener("load", schedule));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (!onScreen) dustContext.clearRect(0, 0, dust.width, dust.height);
      schedule();
    }).observe(stage);
  }
  addEventListener("resize", () => { if (motionOn) sizeDust(); schedule(); }, { passive: true });
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("pageshow", schedule);

  // Fetch the other duets' stills early so a fast scroll never waits for them.
  addEventListener("load", () => {
    for (const scene of scenes) {
      for (const source of [scene.startSrc, scene.endSrc].filter(Boolean)) {
        const image = new Image();
        image.src = source;
      }
    }
  }, { once: true });
  syncMode();
  markCollection();
})();
