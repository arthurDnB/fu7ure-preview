(async () => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const productPage = byId("product-page");
  let catalog = document;
  if (productPage) {
    try {
      const response = await fetch("index.html");
      if (!response.ok) throw new Error("Catalog unavailable");
      const template = document.createElement("template");
      template.innerHTML = await response.text();
      catalog = template.content;
      const details = catalog.querySelector("#product-preview .preview-content");
      const title = document.createElement("h1");
      title.id = "preview-name";
      details.querySelector("#preview-name").replaceWith(title);
      details.querySelector(".editorial-link").href = "./#coming-soon";
      byId("product-sheet").append(details);
      for (const id of ["shopping-bag", "demo-checkout", "bag-item-template"]) {
        document.body.append(catalog.querySelector("#" + id));
      }
    } catch {
      byId("product-message").textContent = "The product catalog is unavailable. Return to the shop to try again.";
      return;
    }
  }

  const browse = byId("shop-browse");
  const styles = catalog.querySelector("#style-catalog");
  const results = byId("catalog-results");
  const productList = byId("filtered-products");
  const summary = byId("catalog-summary");
  const noResults = byId("catalog-empty");
  const search = byId("shop-search");
  const dialog = byId("product-preview");
  const purchaseForm = byId("product-purchase");
  const sizeSelect = byId("preview-size");
  const bagDialog = byId("shopping-bag");
  const bagToggle = byId("bag-toggle");
  const bagItems = byId("bag-items");
  const bagTemplate = byId("bag-item-template");
  const checkoutDialog = byId("demo-checkout");
  const checkoutButton = byId("bag-checkout");
  const shippingForm = byId("shipping-form");
  const shippingReview = byId("shipping-review");
  const checkoutComplete = byId("checkout-complete");
  const bagKey = "fu7ure-preview:bag";
  const supportsBag = typeof bagDialog.showModal === "function";
  const numberFormat = new Intl.NumberFormat("en-AU");
  const categoryButtons = browse ? [...browse.querySelectorAll("[data-category]")] : [];
  const audienceInputs = browse ? [...browse.querySelectorAll("[name=shop-look]")] : [];
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

  const clothingSizes = ["XS", "S", "M", "L", "XL", "XXL"];
  const gearSizes = ["S", "M", "L", "XL"];
  const shoeSizes = Array.from({ length: 11 }, (_, i) => "EU " + (36 + i));
  const sizesByType = {
    Tops: clothingSizes, Bottoms: clothingSizes, Outerwear: clothingSizes,
    Footwear: shoeSizes, Gloves: gearSizes,
  };
  const sizesByProduct = {
    "cybercore-chest-harness": gearSizes,
    "cybercore-amber-helmet": gearSizes,
    "kurowear-rex-g7": gearSizes,
    "goth-half-face-respirator": ["S", "M", "L"],
  };

  const products = [...styles.querySelectorAll(".product")].map((card, index) => {
    const collection = card.closest(".collection");
    const image = card.querySelector("img");
    const name = card.querySelector("h4, h5").textContent;
    const type = card.querySelector(".product-caption > span")?.textContent || "Accessories";
    const style = collection.querySelector(".collection-name").textContent;
    const price = card.querySelector(".product-price");
    const src = image.getAttribute("src");
    const key = src.split("/").pop().replace(/\.webp$/, "");
    return {
      index, card, template: card.cloneNode(true), name, type, style, key, price,
      sizes: sizesByProduct[key] || sizesByType[type] || ["One size"],
      audience: collection.dataset.look,
      collection: collection.id,
      category: ownCategories.has(type) ? type : "Accessories",
      frames: [{ src, label: "Main view" }, ...(angleSources[key] || [])],
      alt: image.alt,
    };
  });

  const productsByKey = new Map(products.map((product) => [product.key, product]));
  const productUrl = (product) => "product.html?item=" + encodeURIComponent(product.key);
  const bagLineKey = (key, size) => key + ":" + size;
  const money = (amount) => "A$" + numberFormat.format(amount);
  let bag = loadBag();
  let previewProduct;
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
    const title = document.createElement("a");
    title.href = productUrl(product);
    title.textContent = product.name;
    caption.querySelector("h4, h5").replaceChildren(title);

    const details = document.createElement("a");
    details.className = "product-open";
    details.href = title.href;
    details.textContent = "View details";
    details.setAttribute("aria-label", "View details for " + product.name);
    const actions = document.createElement("div");
    actions.className = "product-actions";
    actions.append(details);
    if (supportsBag && typeof dialog?.showModal === "function") {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "product-add";
      add.dataset.preview = String(product.index);
      add.textContent = "Add to Bag";
      add.setAttribute("aria-label", "Add " + product.name + " to bag");
      actions.append(add);
    }
    caption.append(actions);
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

  function showProduct(product) {
    previewProduct = product;
    if (supportsBag) {
      const sizes = product.sizes.map((size) => new Option(size, size));
      if (sizes.length > 1) sizes.unshift(new Option("Select size", "", true, true));
      sizeSelect.replaceChildren(...sizes);
    }
    const holder = byId("preview-media");
    const image = document.createElement("img");
    image.src = product.frames[0].src;
    image.alt = product.alt;
    holder.replaceChildren(image);
    addGallery(image, product);
    byId("preview-name").textContent = product.name;
    const previewPrice = byId("preview-price");
    previewPrice.value = product.price.value;
    previewPrice.textContent = product.price.textContent;
    byId("preview-type").textContent = product.style + " / " + product.category;
    const text = byId("preview-description");
    text.textContent = descriptions[product.key] || "";
    text.hidden = !text.textContent;
  }

  function openPreview(product) {
    showProduct(product);
    dialog.showModal();
    sizeSelect.focus();
  }

  function renderProductPage() {
    const key = new URLSearchParams(location.search).get("item");
    const product = productsByKey.get(key);
    const message = byId("product-message");
    if (!product) {
      document.title = "Product not found · FU7URE";
      message.textContent = "This product could not be found. Browse the shop to find another piece.";
      return;
    }

    document.title = product.name + " · FU7URE";
    byId("product-back").href = "./#" + product.collection;
    byId("product-back-label").textContent = product.style;
    showProduct(product);
    byId("product-sheet").hidden = false;
    message.hidden = true;
  }

  function loadBag() {
    const lines = new Map();
    try {
      const saved = JSON.parse(localStorage.getItem(bagKey));
      if (!Array.isArray(saved)) return lines;
      for (const line of saved) {
        const product = productsByKey.get(line?.key);
        if (product?.sizes.includes(line.size) && Number.isSafeInteger(line.quantity) && line.quantity > 0) {
          lines.set(bagLineKey(line.key, line.size), line);
        }
      }
    } catch {
      // The bag can still be used with storage disabled.
    }
    return lines;
  }

  function saveBag() {
    try {
      localStorage.setItem(bagKey, JSON.stringify([...bag.values()]));
    } catch {
      // Keep the current bag in memory if storage becomes unavailable.
    }
    renderBag();
  }

  function renderBag() {
    let count = 0;
    let total = 0;
    const rows = [];
    const summaryRows = [];
    for (const [id, { key, size, quantity }] of bag) {
      const product = productsByKey.get(key);
      const subtotal = Number(product.price.value) * quantity;
      count += quantity;
      total += subtotal;

      const row = bagTemplate.content.firstElementChild.cloneNode(true);
      row.dataset.bagLine = id;
      row.querySelector("img").src = product.frames[0].src;
      const name = row.querySelector(".bag-item-name");
      name.textContent = product.name;
      name.href = productUrl(product);
      const sizeLabel = size === "One size" ? size : "Size " + size;
      row.querySelector(".bag-item-size").textContent = sizeLabel;
      row.querySelector(".bag-item-count").textContent = quantity;
      row.querySelector(".bag-line-total").textContent = money(subtotal);

      const label = product.name + ", " + size;
      row.querySelector(".bag-quantity").setAttribute("aria-label", "Quantity for " + label);
      const less = row.querySelector("[data-bag-action=decrease]");
      less.setAttribute("aria-label", "Decrease quantity of " + label);
      less.disabled = quantity === 1;
      row.querySelector("[data-bag-action=increase]").setAttribute("aria-label", "Increase quantity of " + label);
      row.querySelector("[data-bag-action=remove]").setAttribute("aria-label", "Remove " + label);
      rows.push(row);

      const summaryLine = document.createElement("li");
      const details = document.createElement("span");
      details.textContent = product.name + " · " + sizeLabel + " × " + quantity;
      const amount = document.createElement("span");
      amount.textContent = money(subtotal);
      summaryLine.append(details, amount);
      summaryRows.push(summaryLine);
    }

    bagItems.replaceChildren(...rows);
    byId("bag-empty").hidden = count > 0;
    byId("bag-count").textContent = count;
    byId("bag-total").value = money(total);
    byId("checkout-items").replaceChildren(...summaryRows);
    byId("checkout-subtotal").textContent = money(total);
    byId("checkout-total").textContent = money(total);
    checkoutButton.disabled = count === 0;
    if (!count && checkoutDialog.open && checkoutComplete.hidden) checkoutDialog.close();
  }

  function changeQuantity(event) {
    const button = event.target.closest("[data-bag-action]");
    if (!button) return;
    const { bagLine } = button.closest("[data-bag-line]").dataset;
    const line = bag.get(bagLine);
    const action = button.dataset.bagAction;
    if (action === "remove") {
      const nextRow = button.closest("li").nextElementSibling || button.closest("li").previousElementSibling;
      bag.delete(bagLine);
      saveBag();
      const nextId = nextRow?.dataset.bagLine;
      const target = [...bagItems.children].find((row) => row.dataset.bagLine === nextId);
      (target?.querySelector(".bag-remove") || bagDialog.querySelector(".bag-continue")).focus();
      return;
    }
    const quantity = line.quantity + (action === "increase" ? 1 : -1);
    if (quantity < 1 || !Number.isSafeInteger(quantity)) return;
    line.quantity = quantity;
    saveBag();
    const nextAction = action === "decrease" && quantity === 1 ? "increase" : action;
    const row = [...bagItems.children].find((item) => item.dataset.bagLine === bagLine);
    row.querySelector('[data-bag-action="' + nextAction + '"]').focus({ preventScroll: true });
  }

  function initBag() {
    renderBag();
    purchaseForm.hidden = false;
    bagToggle.hidden = false;
    bagToggle.addEventListener("click", () => bagDialog.showModal());
    initCheckout();
    purchaseForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const size = sizeSelect.value;
      const { key, sizes } = previewProduct;
      if (!sizes.includes(size)) return;
      const id = bagLineKey(key, size);
      const quantity = (bag.get(id)?.quantity || 0) + 1;
      if (!Number.isSafeInteger(quantity)) return;
      bag.set(id, { key, size, quantity });
      saveBag();
      if (dialog?.open) dialog.close();
      bagDialog.showModal();
    });
    bagItems.addEventListener("click", changeQuantity);
    addEventListener("storage", (event) => {
      if (event.key !== bagKey && event.key !== null) return;
      bag = loadBag();
      renderBag();
    });
  }

  function initCheckout() {
    checkoutButton.addEventListener("click", () => {
      if (bag.size) checkoutDialog.showModal();
    });
    shippingForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!bag.size) return;
      const data = new FormData(shippingForm);
      const field = (name) => data.get(name).trim();
      const locality = [field("city"), field("region"), field("postcode")].filter(Boolean).join(" ");
      byId("shipping-address").textContent = [
        field("name"), field("street"), field("unit"), locality, field("country"),
      ].filter(Boolean).join("\n");
      shippingForm.hidden = true;
      shippingReview.hidden = false;
      byId("review-heading").focus();
    });
    byId("edit-shipping").addEventListener("click", () => {
      shippingReview.hidden = true;
      shippingForm.hidden = false;
      shippingForm.elements.namedItem("name").focus();
    });
    byId("finish-checkout").addEventListener("click", () => {
      if (!bag.size) return;
      shippingReview.hidden = true;
      checkoutComplete.hidden = false;
      shippingForm.reset();
      byId("shipping-address").textContent = "";
      byId("checkout-complete-title").focus();
    });
    checkoutDialog.addEventListener("close", () => {
      shippingForm.reset();
      shippingForm.hidden = false;
      shippingReview.hidden = true;
      checkoutComplete.hidden = true;
      byId("shipping-address").textContent = "";
    });
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

  if (supportsBag) initBag();
  if (productPage) {
    renderProductPage();
  } else {
    products.forEach((item) => enhanceCard(item.card, item, false));
    browse.hidden = false;
    browse.addEventListener("change", updateFilteredView);
    search.addEventListener("input", updateFilteredView);
    addEventListener("hashchange", updateNavigation);
    updateNavigation();
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[href^='#']");
    if (anchor && !productPage) {
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

})();
