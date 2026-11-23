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
      byId("product-sheet").prepend(details);
      for (const id of ["shopping-bag", "demo-checkout", "bag-item-template"]) {
        document.body.append(catalog.querySelector("#" + id));
      }
    } catch {
      const message = byId("product-message");
      message.textContent = "The interactive product catalog is unavailable. Return to the shop to try again.";
      message.hidden = false;
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
  const makerFilter = byId("catalog-maker");
  const sizeFilter = byId("catalog-size");
  const sortFilter = byId("catalog-sort");
  const dialog = byId("product-preview");
  const purchaseForm = byId("product-purchase");
  const sizeSelect = byId("preview-size");
  const bagDialog = byId("shopping-bag");
  const bagToggle = byId("bag-toggle");
  const bagItems = byId("bag-items");
  const bagTemplate = byId("bag-item-template");
  const checkoutDialog = byId("demo-checkout");
  const checkoutButton = byId("bag-checkout");
  const bagKey = "fu7ure-preview:bag";
  const supportsBag = typeof bagDialog.showModal === "function";
  const numberFormat = new Intl.NumberFormat("en-AU");
  const decimalFormat = new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const categoryButtons = browse ? [...browse.querySelectorAll("[data-category]")] : [];
  const audienceInputs = browse ? [...browse.querySelectorAll("[name=shop-look]")] : [];
  const mainLinks = [...document.querySelectorAll(".store-nav a")];
  const ownCategories = new Set(["Tops", "Bottoms", "Outerwear", "Footwear"]);
  const angleSources = window.fu7ureProductAngles || {};
  const catalogContent = window.fu7ureCatalog || { details: {}, products: [] };

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

  const concepts = new Map(catalogContent.products.map((item) => [item.key, item]));
  for (const item of concepts.values()) {
    const collection = styles.querySelector("#" + item.collection);
    if (!collection) continue;
    const destination = item.collection === "style-track-techwear" && ownCategories.has(item.type)
      ? collection.querySelector(".products")
      : collection.querySelector(".product-expander .products") || collection.querySelector(".products");
    const card = document.createElement("li");
    card.className = "product";
    card.dataset.productKey = item.key;
    const image = document.createElement("img");
    image.src = item.image;
    image.alt = item.name;
    image.width = image.height = 512;
    image.loading = "lazy";
    const caption = document.createElement("div");
    caption.className = "product-caption";
    const heading = document.createElement("h4");
    heading.textContent = item.name;
    const price = document.createElement("data");
    price.className = "product-price";
    price.value = item.price;
    price.textContent = money(item.price);
    const type = document.createElement("span");
    type.textContent = item.type;
    caption.append(heading, price, type);
    card.append(image, caption);
    destination.append(card);
  }

  const products = [...styles.querySelectorAll(".product")].map((card, index) => {
    const collection = card.closest(".collection");
    const image = card.querySelector("img");
    const heading = card.querySelector("h4, h5");
    const type = card.querySelector(".product-caption > span")?.textContent || "Accessories";
    const style = collection.querySelector(".collection-name").textContent;
    const credit = collection.querySelector(".collection-credit");
    const maker = credit.querySelector("img").alt;
    const price = card.querySelector(".product-price");
    const src = image.getAttribute("src");
    const key = card.dataset.productKey || src.split("/").pop().replace(/\.webp$/, "");
    const specifications = concepts.get(key) || catalogContent.details[key];
    const name = specifications?.name || heading.textContent;
    heading.textContent = name;
    image.alt = name;
    const sizes = sizesByProduct[key] || sizesByType[type] || ["One size"];
    const position = [...key].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const stock = Object.fromEntries(sizes.map((size, i) => [
      size, i === sizes.length - 1 && sizes.length > 2 && position % 3 === 0 ? 0 : 5 + (position + i) % 8,
    ]));
    return {
      index, card, template: card.cloneNode(true), name, type, style, credit, maker, key, price,
      specifications, sizes, stock,
      audience: collection.dataset.look,
      collection: collection.id,
      category: ownCategories.has(type) ? type : "Accessories",
      frames: [{ src, label: "Main view" }, ...(concepts.get(key)?.angles || angleSources[key] || [])],
      alt: image.alt,
    };
  });

  const productsByKey = new Map(products.map((product) => [product.key, product]));
  const productUrl = (product) => "products/" + encodeURIComponent(product.key) + ".html";
  const bagLineKey = (key, size) => key + ":" + size;
  function money(amount) {
    return "A$" + (Number.isInteger(amount) ? numberFormat : decimalFormat).format(amount);
  }
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
    return gallery;
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
    const thumbnails = gallery.parentElement.querySelector(".photo-thumbnails");
    if (thumbnails) {
      [...thumbnails.children].forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    }
  }

  function renderCatalog() {
    const audience = audienceInputs.find((input) => input.checked).value;
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const maker = makerFilter.value;
    const size = sizeFilter.value;
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
      const text = [item.name, item.style, item.maker, item.type, item.category, item.specifications?.description].join(" ").toLowerCase();
      return (category === "all" || item.category === category) &&
        (audience === "all" || item.audience === audience) &&
        (!maker || item.maker === maker) &&
        (!size || item.stock[size] > 0) &&
        terms.every((term) => text.includes(term));
    });
    const comparators = {
      "price-up": (a, b) => Number(a.price.value) - Number(b.price.value),
      "price-down": (a, b) => Number(b.price.value) - Number(a.price.value),
      name: (a, b) => a.name.localeCompare(b.name, "en-AU"),
    };
    if (sortFilter.value) matches.sort(comparators[sortFilter.value]);
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
    makerFilter.value = "";
    sizeFilter.value = "";
    sortFilter.value = "";
    renderCatalog();
  }

  function updateFilteredView() {
    if (category === "style") category = "all";
    renderCatalog();
  }

  function initCatalogFilters() {
    const makers = [...new Set(products.map((product) => product.maker))].sort();
    makerFilter.append(...makers.map((maker) => new Option(maker, maker)));
    const sizes = [...new Set([...clothingSizes, ...shoeSizes, "One size"])];
    sizeFilter.append(...sizes.map((size) => new Option(size, size)));
  }

  function updateStock() {
    if (!previewProduct) return;
    const size = sizeSelect.value;
    const available = previewProduct.stock[size];
    const inBag = bag.get(bagLineKey(previewProduct.key, size))?.quantity || 0;
    const status = byId("preview-stock");
    const add = purchaseForm.querySelector('button[type="submit"]');
    add.disabled = Boolean(size && available <= inBag);
    status.toggleAttribute("data-unavailable", add.disabled);
    status.textContent = !size ? "" : !available ? "Sold out in demo stock."
      : available <= inBag ? "All demo stock for this size is in your bag."
      : available + " available in demo stock.";
  }

  function showProduct(product) {
    previewProduct = product;
    if (supportsBag) {
      const sizes = product.sizes.map((size) => {
        const option = new Option(size + (product.stock[size] ? "" : " — sold out"), size);
        option.disabled = !product.stock[size];
        return option;
      });
      if (sizes.length > 1) sizes.unshift(new Option("Select size", "", true, true));
      sizeSelect.replaceChildren(...sizes);
      updateStock();
    }
    const holder = byId("preview-media");
    const image = document.createElement("img");
    image.src = product.frames[0].src;
    image.alt = product.alt;
    holder.replaceChildren(image);
    const gallery = addGallery(image, product);
    byId("preview-name").textContent = product.name;
    const previewPrice = byId("preview-price");
    previewPrice.value = product.price.value;
    previewPrice.textContent = product.price.textContent;
    byId("preview-type").textContent = product.style + " / " + product.category;
    const text = byId("preview-description");
    text.textContent = product.specifications?.description || "";
    text.hidden = !text.textContent;
    const specs = byId("preview-specifications");
    const rows = Object.entries({
      "Sample materials": product.specifications?.materials,
      "Sample care": product.specifications?.care,
      Fit: product.specifications?.fit,
    }).filter(([, value]) => value).map(([label, value]) => {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = label;
      detail.textContent = value;
      row.append(term, detail);
      return row;
    });
    specs.replaceChildren(...rows);
    specs.hidden = rows.length === 0;
    return gallery;
  }

  function openPreview(product) {
    showProduct(product);
    dialog.showModal();
    sizeSelect.focus();
  }

  function renderProductPhotos(product, gallery) {
    const openPhoto = window.createProductPhotoViewer?.(product);
    if (openPhoto) {
      const mainImage = gallery.querySelector("img");
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "photo-open photo-open-main";
      trigger.setAttribute("aria-label", "Open selected photo full screen");
      trigger.setAttribute("aria-haspopup", "dialog");
      mainImage.before(trigger);
      trigger.append(mainImage);
      trigger.addEventListener("click", () => openPhoto(Number(gallery.dataset.frame), trigger));
    }

    const thumbnails = document.createElement("div");
    thumbnails.className = "photo-thumbnails";
    thumbnails.setAttribute("role", "group");
    thumbnails.setAttribute("aria-label", "Product photo angles");

    const photos = product.frames.map((frame, index) => {
      const image = document.createElement("img");
      image.src = frame.src;
      image.width = image.height = 512;
      image.loading = "lazy";
      image.alt = index === 0 ? product.alt : product.name + " — " + frame.label;

      if (product.frames.length > 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", "Show " + frame.label.toLowerCase());
        button.setAttribute("aria-pressed", String(index === 0));

        const thumbnail = image.cloneNode();
        thumbnail.alt = "";
        thumbnail.width = thumbnail.height = 64;
        const label = document.createElement("span");
        label.textContent = frame.label;
        button.append(thumbnail, label);
        button.addEventListener("click", () => showAngle(gallery, product, index));
        thumbnails.append(button);
      }

      const figure = document.createElement("figure");
      const trigger = document.createElement(openPhoto ? "button" : "a");
      trigger.className = "photo-open";
      trigger.setAttribute("aria-label", "Open " + frame.label.toLowerCase() + " full screen");
      if (openPhoto) {
        trigger.type = "button";
        trigger.setAttribute("aria-haspopup", "dialog");
        trigger.addEventListener("click", () => openPhoto(index, trigger));
      } else {
        trigger.href = frame.src;
      }
      trigger.append(image);
      const caption = document.createElement("figcaption");
      caption.textContent = frame.label;
      figure.append(trigger, caption);
      return figure;
    });

    if (thumbnails.childElementCount) gallery.after(thumbnails);
    byId("product-photo-list").replaceChildren(...photos);
  }

  function renderSizeGuide(product) {
    const template = byId("product-guide-template").content.cloneNode(true);
    const toggle = template.querySelector("button");
    const guide = template.querySelector("section");
    const sizeHeading = document.createElement("div");
    sizeHeading.className = "product-size-heading";
    const label = purchaseForm.querySelector("label");
    label.before(sizeHeading);
    sizeHeading.append(label, toggle);
    purchaseForm.after(guide);

    byId("product-size-options").textContent = product.sizes.join(" · ");
    const fitNotes = {
      Tops: "Measure around the fullest part of your chest.",
      Outerwear: "Measure around your chest over the layer you plan to wear underneath.",
      Bottoms: "Measure around your waist where you want the waistband to sit.",
      Footwear: "Check the EU size marked inside a pair of shoes that fits you well.",
      Gloves: "Measure around your palm across the knuckles, leaving out the thumb.",
    };
    const fit = product.sizes.length === 1
      ? "This piece has one preview size."
      : fitNotes[product.type] || "";
    const chart = productMeasurements(product);
    const advice = chart ? "Use these sample measurements to test size selection." : "See the sample fit notes for this piece.";
    byId("product-size-advice").textContent = [fit, advice].filter(Boolean).join(" ");
    if (chart) byId("product-measurements").append(chart);

    toggle.addEventListener("click", () => {
      guide.hidden = !guide.hidden;
      toggle.setAttribute("aria-expanded", String(!guide.hidden));
    });
  }

  function productMeasurements(product) {
    const measurements = {
      chest: ["80–86", "87–93", "94–100", "101–107", "108–114", "115–121"],
      waist: ["63–69", "70–76", "77–83", "84–90", "91–97", "98–104"],
      palm: ["15–16", "16–18", "18–20", "20–22", "22–24", "24–26"],
      head: ["52–54", "54–56", "56–58", "58–60", "60–62", "62–64"],
    };
    const measure = product.type === "Bottoms" ? "waist"
      : product.type === "Gloves" ? "palm"
      : /helmet|rex-g7/.test(product.key) ? "head" : "chest";
    if (product.sizes.length === 1 || /respirator/.test(product.key)) return null;
    const shoe = product.type === "Footwear";
    const table = document.createElement("table");
    table.className = "product-measurement-table";
    table.createCaption().textContent = "Sample body measurements in cm";
    const header = table.createTHead().insertRow();
    for (const label of ["Size", shoe ? "Foot length" : measure[0].toUpperCase() + measure.slice(1)]) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      header.append(cell);
    }
    const body = table.createTBody();
    for (const [index, size] of product.sizes.entries()) {
      const row = body.insertRow();
      const heading = document.createElement("th");
      heading.scope = "row";
      heading.textContent = size;
      row.append(heading);
      row.insertCell().textContent = shoe ? (22.3 + index * 0.64).toFixed(1) : measurements[measure][clothingSizes.indexOf(size)];
    }
    return table;
  }

  function renderProductPage() {
    const key = productPage.dataset.productKey || new URLSearchParams(location.search).get("item");
    const product = productsByKey.get(key);
    const message = byId("product-message");
    if (!product) {
      document.title = "Product not found · FU7URE";
      message.textContent = "This product could not be found. Browse the shop to find another piece.";
      message.hidden = false;
      return;
    }

    document.title = product.name + " · FU7URE";
    byId("product-back").href = "./#" + product.collection;
    byId("product-back-label").textContent = product.style;
    const gallery = showProduct(product);
    const styleName = document.createElement("span");
    styleName.textContent = product.style;
    byId("preview-type").replaceChildren(styleName, product.credit.cloneNode(true));
    renderProductPhotos(product, gallery);
    if (supportsBag) renderSizeGuide(product);
    byId("product-sheet").hidden = false;
    byId("product-static")?.remove();
    message.hidden = true;
  }

  function loadBag() {
    const lines = new Map();
    try {
      const saved = JSON.parse(localStorage.getItem(bagKey));
      if (!Array.isArray(saved)) return lines;
      for (const line of saved) {
        const product = productsByKey.get(line?.key);
        if (product?.stock[line.size] > 0 && Number.isSafeInteger(line.quantity) && line.quantity > 0) {
          const quantity = Math.min(line.quantity, product.stock[line.size]);
          lines.set(bagLineKey(line.key, line.size), { key: line.key, size: line.size, quantity });
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
    updateStock();
  }

  function renderBag() {
    let count = 0;
    let total = 0;
    const rows = [];
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
      const more = row.querySelector("[data-bag-action=increase]");
      more.setAttribute("aria-label", "Increase quantity of " + label);
      more.disabled = quantity >= product.stock[size];
      row.querySelector("[data-bag-action=remove]").setAttribute("aria-label", "Remove " + label);
      rows.push(row);
    }

    bagItems.replaceChildren(...rows);
    byId("bag-empty").hidden = count > 0;
    byId("bag-count").textContent = count;
    byId("bag-total").value = money(total);
    checkoutButton.disabled = count === 0;
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
    if (quantity < 1 || quantity > productsByKey.get(line.key).stock[line.size]) return;
    line.quantity = quantity;
    saveBag();
    const row = [...bagItems.children].find((item) => item.dataset.bagLine === bagLine);
    const sameControl = row.querySelector('[data-bag-action="' + action + '"]:enabled');
    (sameControl || row.querySelector(".bag-quantity button:enabled")).focus({ preventScroll: true });
  }

  function initBag() {
    renderBag();
    purchaseForm.hidden = false;
    bagToggle.hidden = false;
    bagToggle.addEventListener("click", () => bagDialog.showModal());
    initCheckout();
    sizeSelect.addEventListener("change", updateStock);
    purchaseForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const size = sizeSelect.value;
      const { key, stock } = previewProduct;
      const id = bagLineKey(key, size);
      const quantity = (bag.get(id)?.quantity || 0) + 1;
      if (!(quantity <= stock[size])) return;
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
      updateStock();
    });
  }

  function initCheckout() {
    const checkout = window.fu7ureCheckout?.init({
      dialog: checkoutDialog,
      money,
      getOrder: () => [...bag.values()].map((line) => {
        const product = productsByKey.get(line.key);
        return { ...line, name: product.name, unitPrice: Number(product.price.value), image: product.frames[0].src };
      }),
      clearBag: () => {
        bag.clear();
        saveBag();
      },
    });
    if (!checkout) return;
    checkoutButton.addEventListener("click", () => checkout.open(checkoutButton));
    byId("prototype-orders")?.addEventListener("click", (event) => checkout.openOrders(event.currentTarget));
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
    initCatalogFilters();
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
    if (!gallery || (productPage && gallery.nextElementSibling?.matches(".photo-thumbnails"))) return;
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
