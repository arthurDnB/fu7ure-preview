(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const browse = byId("shop-browse");
  const styles = byId("style-catalog");
  const results = byId("catalog-results");
  const productList = byId("filtered-products");
  const summary = byId("catalog-summary");
  const noResults = byId("catalog-empty");
  const search = byId("shop-search");
  const dialog = byId("product-preview");
  const categoryButtons = [...browse.querySelectorAll("[data-category]")];
  const audienceInputs = [...browse.querySelectorAll("[name=shop-look]")];
  const mainLinks = [...document.querySelectorAll(".store-nav a")];
  const ownCategories = new Set(["Tops", "Bottoms", "Outerwear", "Footwear"]);
  const angleSources = window.fu7ureProductAngles || {};
  const descriptions = {
    "cybercore-chest-harness": "Black shoulder straps and front buckles layered over a fitted top.",
    "cybercore-controller-bag": "A crossbody bag with a wide strap and compact silhouette.",
    "cybercore-amber-helmet": "A black full-face helmet with swept ears and amber rings.",
    "cybercore-oversized-pilot-cargos": "A broad cargo silhouette that gathers below the knee.",
    "warcore-olive-utility-vest": "An olive utility vest with stacked front pockets and rear webbing.",
    "kurowear-yellow-panel-shell": "An asymmetric yellow sleeve breaks up a black hooded shell.",
    "kurowear-pilot-boots": "Black and white boots with yellow pull tabs and chunky soles.",
    "kurowear-rex-g7": "A dark faceplate, round brow pieces and sharp yellow lines.",
    "techwear-reflective-jacket": "A clean black utility jacket with contrast piping and a tall collar.",
    "techwear-wraparound-visor": "A clear visor with a broad wraparound profile.",
    "goth-laced-hooded-coat": "A full-length black hooded coat with lacing and metal hardware.",
    "goth-violet-goggles": "Round violet lenses framed by the black hood.",
    "goth-platform-boots": "Tall black soles under the hem of the laced coat.",
    "track-techwear-racing-jersey": "A boxy black jersey with an orange 23 and contrast sleeve trim.",
    "track-techwear-race-stripe-cargos": "A relaxed black cargo cut with orange stripes and zipped pockets.",
    "track-techwear-track-cap": "A curved-brim black cap worn with the Track Techwear look.",
    "track-techwear-comms-earpiece": "An orange-accented earpiece with a short boom mic.",
  };

  const products = [...styles.querySelectorAll(".product")].map((card, index) => {
    const collection = card.closest(".collection");
    const image = card.querySelector("img");
    const name = card.querySelector("h4, h5").textContent;
    const type = card.querySelector(".product-caption > span")?.textContent || "Accessories";
    const style = collection.querySelector("h3").textContent;
    const src = image.getAttribute("src");
    const key = src.split("/").pop().replace(/\.webp$/, "");
    return {
      index, card, template: card.cloneNode(true), name, type, style, key,
      audience: collection.dataset.look,
      category: ownCategories.has(type) ? type : "Accessories",
      frames: [{ src, label: "Main view" }, ...(angleSources[key] || [])],
      alt: image.alt,
    };
  });

  let category = "style";
  const warmed = new Set();

  function galleryButton(direction, product) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.angleStep = String(direction);
    button.className = "angle-button";
    button.textContent = direction < 0 ? "‹" : "›";
    button.setAttribute("aria-label", (direction < 0 ? "Previous" : "Next") + " angle of " + product.name);
    return button;
  }

  function addGallery(image, product) {
    const gallery = document.createElement("div");
    gallery.className = "product-gallery";
    gallery.dataset.product = String(product.index);
    gallery.dataset.frame = "0";
    image.before(gallery);
    gallery.append(image);
    if (product.frames.length > 1) {
      const controls = document.createElement("div");
      controls.className = "angle-bar";
      const readout = document.createElement("span");
      readout.className = "angle-readout";
      readout.textContent = "1 / " + product.frames.length;
      controls.append(galleryButton(-1, product), readout, galleryButton(1, product));
      gallery.append(controls);
    }
  }

  function enhanceCard(card, product, showStyle) {
    addGallery(card.querySelector("img"), product);
    const caption = card.querySelector(".product-caption");
    if (showStyle) {
      const style = document.createElement("span");
      style.textContent = product.style;
      caption.append(style);
    }
    if (typeof dialog.showModal === "function") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "product-open";
      button.dataset.preview = String(product.index);
      button.textContent = "View details";
      button.setAttribute("aria-label", "View details for " + product.name);
      caption.append(button);
    }
    return card;
  }

  function warmAngles(product) {
    if (warmed.has(product.index)) return;
    warmed.add(product.index);
    product.frames.slice(1).forEach(({ src }) => {
      const image = new Image();
      image.src = src;
    });
  }

  function showAngle(gallery, product, index) {
    if (Number(gallery.dataset.frame) === index) return;
    const frame = product.frames[index];
    const image = gallery.querySelector("img");
    gallery.dataset.frame = String(index);
    image.src = frame.src;
    image.alt = index === 0 ? product.alt : product.name + " — " + frame.label;
    const readout = gallery.querySelector(".angle-readout");
    if (readout) readout.textContent = (index + 1) + " / " + product.frames.length;
  }

  function renderCatalog() {
    const audience = audienceInputs.find((input) => input.checked).value;
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const byStyle = category === "style";
    categoryButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.category === category));
    });
    styles.hidden = !byStyle;
    results.hidden = byStyle;

    if (byStyle) {
      productList.replaceChildren();
      return;
    }

    const matches = products.filter((item) => {
      const text = [item.name, item.style, item.type, item.category].join(" ").toLowerCase();
      return (category === "all" || item.category === category) &&
        (audience === "all" || item.audience === audience) &&
        terms.every((term) => text.includes(term));
    });
    productList.replaceChildren(...matches.map((item) => enhanceCard(item.template.cloneNode(true), item, true)));
    noResults.hidden = matches.length !== 0;
    const label = matches.length === 1 ? " piece" : " pieces";
    const look = audience === "all" ? "" : " in " + (audience === "men" ? "men’s looks" : "women’s looks");
    summary.textContent = matches.length + label + look;
  }

  function shopByStyle() {
    category = "style";
    audienceInputs[0].checked = true;
    search.value = "";
    renderCatalog();
  }

  function updateFilteredView() {
    if (category === "style") category = "all";
    renderCatalog();
  }

  function openPreview(product) {
    const holder = byId("preview-media");
    const image = document.createElement("img");
    image.src = product.frames[0].src;
    image.alt = product.alt;
    holder.replaceChildren(image);
    addGallery(image, product);
    byId("preview-name").textContent = product.name;
    byId("preview-type").textContent = product.style + " / " + product.category;
    const text = byId("preview-description");
    text.textContent = descriptions[product.key] || "";
    text.hidden = !text.textContent;
    dialog.showModal();
  }

  function styleAnchor(hash) {
    const target = hash && byId(hash.slice(1));
    return target && styles.contains(target) ? target : null;
  }

  function updateNavigation() {
    const anchor = styleAnchor(location.hash);
    if (anchor && styles.hidden) {
      shopByStyle();
      requestAnimationFrame(() => anchor.scrollIntoView({ behavior: "instant" }));
    }
    const inShop = anchor || location.hash === "#merchandise";
    const hash = inShop ? "#merchandise" : location.hash || "#show";
    mainLinks.forEach((link) => {
      if (link.getAttribute("href") === hash) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  products.forEach((item) => enhanceCard(item.card, item, false));
  browse.hidden = false;
  browse.addEventListener("change", updateFilteredView);
  search.addEventListener("input", updateFilteredView);

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[href^='#']");
    if (anchor) {
      if (styles.hidden && styleAnchor(anchor.getAttribute("href"))) shopByStyle();
      if (dialog.open && dialog.contains(anchor)) dialog.close();
    }
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.category) {
      if (button.dataset.category === "style") shopByStyle();
      else {
        category = button.dataset.category;
        renderCatalog();
      }
    } else if (button.id === "clear-filters") {
      shopByStyle();
      search.focus();
    } else if (button.dataset.preview !== undefined) {
      openPreview(products[Number(button.dataset.preview)]);
    } else if (button.dataset.angleStep) {
      const gallery = button.closest(".product-gallery");
      const product = products[Number(gallery.dataset.product)];
      const count = product.frames.length;
      const next = (Number(gallery.dataset.frame) + Number(button.dataset.angleStep) + count) % count;
      warmAngles(product);
      showAngle(gallery, product, next);
    }
  });

  document.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" || event.target.closest(".angle-bar")) return;
    const gallery = event.target.closest(".product-gallery");
    if (!gallery) return;
    const product = products[Number(gallery.dataset.product)];
    const box = gallery.getBoundingClientRect();
    const fraction = Math.min(0.999, Math.max(0, (event.clientX - box.left) / box.width));
    gallery.dataset.hover = "true";
    if (product.frames.length > 1) {
      warmAngles(product);
      showAngle(gallery, product, Math.floor(fraction * product.frames.length));
    } else {
      const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
      gallery.style.setProperty("--zoom-x", (fraction * 100) + "%");
      gallery.style.setProperty("--zoom-y", (y * 100) + "%");
      gallery.dataset.zoom = "true";
    }
  }, { passive: true });

  document.addEventListener("pointerout", (event) => {
    const gallery = event.target.closest(".product-gallery");
    if (!gallery || gallery.contains(event.relatedTarget) || !gallery.dataset.hover) return;
    delete gallery.dataset.hover;
    delete gallery.dataset.zoom;
  }, { passive: true });

  addEventListener("hashchange", updateNavigation);
  updateNavigation();
})();
