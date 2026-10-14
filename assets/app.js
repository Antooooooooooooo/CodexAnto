/* DEGSE — interface, import local et sauvegardes. Pas d’envoi du portefeuille. */
(async () => {
  "use strict";
  const D = window.DEGSE,
    $ = (id) => document.getElementById(id),
    STORAGE = "degse-international-v8";
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $("themeToggle").setAttribute("aria-pressed", String(theme === "dark"));
    $("themeLabel").textContent = theme === "dark" ? "Thème clair" : "Thème sombre";
    $("themeToggle").title = theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre";
  }
  applyTheme(document.documentElement.dataset.theme);
  $("themeToggle").addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(theme);
    try { localStorage.setItem("degse-theme", theme); } catch (_) {}
  });
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const money = (n, currency = "EUR") =>
    n === null || n === undefined
      ? D.UNKNOWN
      : currency === "Autre"
        ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
            n,
          ) + " (devise à préciser)"
        : new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
          }).format(n);
  const badge = (s, tone = "neutral") =>
    `<span class="badge ${tone}">${esc(s)}</span>`;
  const sub = (s) => `<span class="sub">${esc(s)}</span>`;
  const link = (u, label = "Source") =>
    D.safeURL(u)
      ? `<a href="${esc(D.safeURL(u))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`
      : "";
  const historical = JSON.parse($("historicalData").textContent),
    supplied = JSON.parse($("suppliedData").textContent),
    verified = JSON.parse($("verifiedData").textContent),
    base = D.addContributions(D.addContributions(D.fromLegacy(historical), supplied), verified);
  const official = verified.records.filter((e) => e.kind === "registry"),
    documentary = verified.records.filter((e) => e.kind === "documentary");
  $("researchSummary").textContent = `${official.length} sièges et activités vérifiés au registre · ${official.filter((e) => e.fields.registeredRevenue).length} CA des comptes de société disponibles · ${documentary.length} fiches avec nouveaux compléments documentaires · Consultation du 13/10/2026. Les champs mondiaux encore manquants sont signalés dans les fiches.`;
  const contributionLabel = (entry) => entry.kind === "registry" ? "Registre officiel vérifié"
    : entry.kind === "documentary" ? "Recherche documentaire" : "Complément utilisateur";
  let overrides = {},
    clients = {},
    loadedSheets = [],
    fileName = "",
    page = 1,
    activeId = "",
    sort = { key: "priority", dir: 1 },
    visible = [];
  let criteria = {
    targets: [...D.BORDER],
    hq: "any",
    minRevenue: 0,
    operationalOnly: true,
    includeGroups: true,
  };
  try {
    let saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (saved?.encoding === "gzip-base64") {
      const bytes = Uint8Array.from(atob(saved.data), (c) => c.charCodeAt(0));
      saved = JSON.parse(await new Response(new Blob([bytes]).stream()
        .pipeThrough(new DecompressionStream("gzip"))).text());
    }
    if (saved?.schemaVersion === 1) {
      const validated = {};
      for (const [id, r] of Object.entries(saved.researches || {})) {
        if (id !== r.siren)
          throw Error("Identifiant de sauvegarde incohérent.");
        validated[id] = D.validateResearch(r);
      }
      overrides = validated;
      if (validCriteria(saved.criteria)) criteria = saved.criteria;
    }
  } catch (e) {
    notice(
      "La sauvegarde locale n’a pas pu être chargée : " +
        e.message +
        " Les recherches historiques restent disponibles.",
      true,
    );
  }
  function validCriteria(c) {
    return (
      c &&
      Array.isArray(c.targets) &&
      c.targets.length > 0 &&
      c.targets.every((v) => [...D.BORDER, D.OTHER].includes(v)) &&
      ["any", "France", "foreign"].includes(c.hq) &&
      Number.isFinite(c.minRevenue) &&
      c.minRevenue >= 0 &&
      typeof c.operationalOnly === "boolean" &&
      typeof c.includeGroups === "boolean"
    );
  }
  function notice(message, error = false) {
    $("notice").textContent = message;
    $("notice").className = "notice" + (error ? " error" : "");
    $("notice").hidden = false;
  }
  let persistenceQueue = Promise.resolve();
  async function persist() {
    // Capture avant l'opération asynchrone ; les écritures successives gardent leur ordre.
    const payload = JSON.stringify({ schemaVersion: 1, researches: overrides, criteria });
    const operation = persistenceQueue.then(async () => {
      try {
        let encoded = payload;
        if (typeof CompressionStream === "function" && typeof DecompressionStream === "function") {
          const bytes = new Uint8Array(await new Response(new Blob([payload]).stream()
            .pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
          let binary = "";
          for (let i = 0; i < bytes.length; i += 8192)
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          encoded = JSON.stringify({encoding: "gzip-base64", data: btoa(binary)});
        }
        localStorage.setItem(STORAGE, encoded);
        $("storageStatus").textContent =
          "Modifications enregistrées dans ce navigateur. Exportez une sauvegarde JSON pour les conserver, changer de navigateur ou partager le travail.";
      } catch {
        $("storageStatus").textContent =
          "Stockage local indisponible ou saturé : vos modifications restent dans cette session. Exportez immédiatement une sauvegarde JSON.";
        notice(
          "Les modifications sont actives, mais leur sauvegarde locale a échoué. Utilisez « Sauvegarder les recherches ».",
          true,
        );
      }
    });
    persistenceQueue = operation.catch(() => {});
    await operation;
  }
  function research(id) {
    const original = base[id] || D.emptyResearch(id);
    if (overrides[id]) {
      overrides[id] = D.reconcileResearch(original, overrides[id]);
      return overrides[id];
    }
    return original;
  }
  function dataset() {
    const today = todayParis();
    return D.unique([
      ...Object.keys(clients),
      ...Object.keys(base),
      ...Object.keys(overrides),
    ]).map((id) => {
      const c = clients[id] || null,
        r = research(id),
        q = D.qualify(r, criteria),
        health = D.sourceHealth(r, today);
      return {
        id,
        c,
        r,
        q,
        health,
        priority: D.contactPriority(c, r, criteria, today, q, health),
        name: c?.name || r.name || `Entreprise · ${id}`,
        op: D.opportunities(c, r),
      };
    });
  }
  function chips(id, values, selected = []) {
    $(id).innerHTML = values
      .map(
        (v) =>
          `<label><input type="checkbox" value="${esc(v)}" ${selected.includes(v) ? "checked" : ""}>${esc(v === D.OTHER ? "International — Autre" : v)}</label>`,
      )
      .join("");
  }
  chips("targetCountries", [...D.BORDER, D.OTHER], criteria.targets);
  $("hq").value = criteria.hq;
  $("minRevenue").value = criteria.minRevenue || "";
  $("presenceRule").value = criteria.operationalOnly ? "operational" : "commercial";
  $("groupRule").value = criteria.includeGroups ? "include" : "entity";
  function checked(id) {
    return [...$(id).querySelectorAll("input:checked")].map((el) => el.value);
  }
  function fillSelect(id, values, extra = []) {
    const el = $(id),
      old = el.value;
    el.innerHTML =
      `<option value="">${id === "vrc" ? "Tous" : "Toutes"}</option>` +
      D.unique(values)
        .sort((a, b) => a.localeCompare(b, "fr"))
        .map((v) => `<option value="${esc(v)}">${esc(v)}</option>`)
        .join("") +
      extra.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
    el.value = old;
  }
  function populate() {
    const rows = dataset();
    fillSelect(
      "direction",
      rows
        .map((x) => x.c?.direction || "")
        .concat(Object.keys(clients).length ? ["AURA", "RM"] : []),
      [["unknown", "Non renseigné"]],
    );
    fillSelect(
      "vrc",
      rows.map((x) => x.c?.vrc || ""),
      [["unknown", "Non renseigné"]],
    );
  }
  const todayParis = () => new Intl.DateTimeFormat("fr-CA", {timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const actionDue = r => !!r.nextActionDate && r.nextActionDate <= todayParis() && r.commercialStatus !== "À écarter";
  function filtered(ignoreView = false, rows = dataset()) {
    const query = D.norm($("search").value), activity = D.norm($("sector").value);
    return rows.filter(({c,r,q,name,id}) => {
      const scope = $("scope").value;
      if ((scope === "portfolio" && !c) || (scope === "researchedPortfolio" && (!c || !r.analyzed)) ||
          (scope === "research" && !r.analyzed && !r.selected && r.commercialStatus === "Non planifié" && !r.nextActionDate && !r.commercialNotes)) return false;
      if (query && !D.norm(`${name} ${id} ${r.groupName} ${c?.groupName || ""}`).includes(query)) return false;
      for (const field of ["direction", "segment", "vrc"]) {
        const value = $(field).value;
        if (value && (value === "unknown" ? !!c?.[field] : value !== c?.[field])) return false;
      }
      if (activity && !D.norm(`${c?.sector || ""} ${r.sector} ${r.registryActivity}`).includes(activity)) return false;
      if ((criteria.hq === "France" && r.hq !== "France") ||
          (criteria.hq === "foreign" && (!r.hq || r.hq === "France"))) return false;
      const group = $("group").value;
      if ((group === "foreign" && (!r.groupHQ || r.groupHQ === "France")) ||
          (group === "france" && r.groupHQ !== "France") ||
          (group === "unknown" && r.groupRelation !== "Inconnu" && r.groupHQ)) return false;
      if (ignoreView) return true;
      const view = $("view").value;
      return view === "all" ||
        (view === "targeted" && D.zones(r.countries).some(zone => criteria.targets.includes(zone))) ||
        (view === "confirmed" && q.status === "Cible confirmée") ||
        (view === "qualify" && q.status === "À qualifier") ||
        (view === "unanalysed" && !r.analyzed) ||
        (view === "selected" && r.selected) || (view === "due" && actionDue(r));
    });
  }
  function revenue(r) {
    return r.revenue.amount !== null
      ? money(r.revenue.amount, r.revenue.currency)
      : r.revenue.reported || r.publishedRevenue || "Non communiqué";
  }
  function sortValue(x, key) {
    return {
      name: x.name,
      direction: x.c?.direction,
      vrc: x.c?.vrc,
      caOrange: x.c?.caOrange,
      priority: x.priority.rank,
      revenue:
        x.r.revenue.amount !== null && x.r.revenue.currency === "EUR"
          ? x.r.revenue.amount
          : null,
      status: {"Cible confirmée":0,"À qualifier":1,"Non analysé":2,"Hors critères":3}[x.q.status],
    }[key];
  }
  function render() {
    const rows = dataset();
    visible = filtered(false, rows).sort((a, b) => {
      const av = sortValue(a, sort.key),
        bv = sortValue(b, sort.key);
      if (av == null || av === "") return bv == null || bv === "" ? 0 : 1;
      if (bv == null || bv === "") return -1;
      return (
        (typeof av === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "fr", { numeric: true })) *
        sort.dir || a.name.localeCompare(b.name, "fr")
      );
    });
    const pages = Math.max(1, Math.ceil(visible.length / 40));
    page = Math.min(page, pages);
    const contextRows = filtered(true, rows), selected = contextRows.filter(x => x.r.selected).length;
    $("metrics").innerHTML = [
      {n:contextRows.length, label:"Comptes dans le périmètre", note:"Fichier et filtres commerciaux", view:"all"},
      {n:contextRows.filter(x=>x.q.status === "Cible confirmée").length, label:"Cibles confirmées", note:"Présence ciblée documentée", view:"confirmed", tone:"success"},
      {n:contextRows.filter(x=>x.q.status === "À qualifier").length, label:"À qualifier", note:"Informations à valider ou compléter", view:"qualify"},
      {n:selected, label:"Ma sélection", note:"Comptes retenus pour la prospection", view:"selected"},
    ].map(x=>`<button class="metric ${x.tone || ""} ${$("view").value === x.view ? "active" : ""}" data-view="${x.view}" aria-label="Afficher ${esc(x.label)}"><span class="metric-label">${x.label}</span><strong>${x.n.toLocaleString("fr-FR")}</strong><span class="metric-note">${x.note}</span></button>`).join("");
    $("resultCount").textContent = `${visible.length.toLocaleString("fr-FR")} compte(s) · ${$("view").selectedOptions[0].textContent}`;
    const countPriority = label => visible.filter(x => x.priority.label === label).length.toLocaleString("fr-FR");
    $("prospectingSummary").textContent = `Dans cette vue : ${countPriority("Contact à préparer")} contact(s) à préparer · ${countPriority("Couverture à valider")} couverture(s) Orange à valider · ${countPriority("Informations à actualiser")} dossier(s) à actualiser. Priorité fondée sur la présence ciblée, la couverture déclarée et l’actualité des preuves.`;
    const active = [criteria.targets.join(", "), criteria.operationalOnly ? "Implantations propres" : "Présence commerciale incluse",
      ...["direction", "segment", "vrc", "group"].filter(id => $(id).value).map(id => $(id).selectedOptions[0].textContent),
      ...(criteria.hq !== "any" ? [criteria.hq === "France" ? "Siège français" : "Siège hors France"] : []),
      ...(criteria.minRevenue ? [`CA mondial ≥ ${money(criteria.minRevenue)}`] : []),
      ...($("sector").value ? [`Activité : ${$("sector").value}`] : []),
      ...(!criteria.includeGroups ? ["Entité cliente uniquement"] : [])];
    $("activeFilters").textContent = active.join(" · ");
    $("selectViewBtn").disabled = !visible.length;
    $("selectViewBtn").textContent = visible.length && visible.every(x=>x.r.selected) ? "Retirer cette vue de ma sélection" : "Sélectionner cette vue";
    $("tableBody").innerHTML = visible.slice((page - 1) * 40, page * 40).map(({id,c,r,q,name,priority}) => {
      const knownCountries = r.documentedCountries ?? r.countries;
      const countryLabels = knownCountries.slice(0,3).map(country => `<span class="country-label">${esc(country)}</span>`).join("") +
        (knownCountries.length > 3 ? `<span class="country-label">+${knownCountries.length - 3}</span>` : "");
      const activity = r.sector || r.registryActivity || D.UNKNOWN;
      const statusNote = q.status === "Cible confirmée" ? q.matched.join(", ") : q.reasons[0] || "";
      const groupInfo = r.groupName ? `${r.groupName} · ${r.groupHQ || "siège à préciser"}` : "Groupe à préciser";
      const action = r.commercialStatus;
      return `<tr class="${r.selected ? "is-selected" : ""}"><td class="selection-col"><input type="checkbox" data-select="${id}" aria-label="Sélectionner ${esc(name)}" ${r.selected ? "checked" : ""}></td><td><button class="company-link" data-company="${id}">${esc(name)}</button>${sub(id)}${r.registryState === "Fermée" ? badge("Entité fermée", "warning") : c?.duplicate ? badge("Doublon Excel", "warning") : ""}</td><td>${esc(c?.vrc || "—")}${sub([c?.direction, c?.segment].filter(Boolean).join(" · ") || "Excel non renseigné")}</td><td>${esc(c ? money(c.caOrange) : "—")}${sub("Relation Orange")}</td><td><span class="clamp" title="${esc(activity)}">${esc(activity)}</span><div class="country-list">${countryLabels || sub("Pays à préciser")}</div>${sub(r.presenceScope === "Inconnu" ? "Périmètre à préciser" : `${r.presenceScope} · ${r.presenceType}`)}${knownCountries.length && !D.documentaryProof(r,"presence") && !r.reviewed ? sub("Présence historique / fournie à vérifier") : ""}</td><td>${esc(r.hq || "À préciser")}${sub(groupInfo)}</td><td><span class="clamp" title="${esc(revenue(r))}">${esc(revenue(r))}</span>${sub(`${r.revenue.year || "Exercice à préciser"} · ${(r.revenue.scope === "Inconnu" ? "périmètre à préciser" : r.revenue.scope)}`)}${(r.revenue.amount !== null || r.revenue.reported || r.publishedRevenue) && !D.proof(r,"revenue") ? sub("Montant historique / fourni à vérifier") : ""}</td><td>${badge(q.status, q.tone)}<span class="sub clamp" title="${esc(statusNote)}">${esc(statusNote)}</span>${q.basis ? sub(q.basis) : ""}</td><td>${badge(priority.label,priority.tone)}<span class="sub clamp" title="${esc(priority.reasons.join(" "))}">${esc(priority.reasons[0] || "")}</span>${sub(action)}${r.nextActionDate ? sub(`${actionDue(r) ? "Relance à faire" : "Prochaine action"} : ${displayDate(r.nextActionDate)}`) : ""}<button class="row-action" data-company="${id}" data-sales="true">Ouvrir le suivi →</button></td></tr>`;
    }).join("") || '<tr><td colspan="9" class="empty">Aucun compte dans cette vue. <button class="text-button" data-show-all>Voir toutes les entreprises</button> ou réinitialisez le ciblage.</td></tr>';
    $("pageMeta").textContent =
      `Page ${page} / ${pages} · 40 entreprises par page`;
    $("prevBtn").disabled = page <= 1;
    $("nextBtn").disabled = page >= pages;
    for (const btn of document.querySelectorAll("[data-sort]")) {
      const th = btn.closest("th");
      th.removeAttribute("aria-sort");
      if (btn.dataset.sort === sort.key)
        th.setAttribute(
          "aria-sort",
          sort.dir === 1 ? "ascending" : "descending",
        );
    }
  }
  function displayDate(date) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date.split("-").reverse().join("/") : "date à préciser";
  }
  function profileTab(panel) {
    for (const button of document.querySelectorAll("[data-profile-tab]")) {
      const active = button.dataset.profileTab === panel;
      button.setAttribute("aria-selected", String(active));button.tabIndex=active ? 0 : -1;
      $(button.dataset.profileTab).hidden = !active;
    }
  }
  const tabButtons = [...document.querySelectorAll("[data-profile-tab]")];
  for (const [index,button] of tabButtons.entries()) {
    button.addEventListener("click",()=>profileTab(button.dataset.profileTab));
    button.addEventListener("keydown",event=>{
      let next;
      if (event.key === "ArrowRight") next=(index+1)%tabButtons.length;
      if (event.key === "ArrowLeft") next=(index+tabButtons.length-1)%tabButtons.length;
      if (event.key === "Home") next=0;
      if (event.key === "End") next=tabButtons.length-1;
      if (next !== undefined) {event.preventDefault();profileTab(tabButtons[next].dataset.profileTab);tabButtons[next].focus();}
    });
  }
  function commercialBrief(c,r,q,op) {
    const health = D.sourceHealth(r,todayParis()), priority = D.contactPriority(c,r,criteria,todayParis(),q,health);
    return [c?.name || r.name || `Entreprise ${r.siren}`,`SIREN : ${r.siren}`,
      `Commercial / portefeuille : ${[c?.vrc,c?.direction,c?.segment].filter(Boolean).join(" · ") || "À renseigner dans l’Excel"}`,
      `Qualification documentaire : ${q.status}${q.basis ? " — "+q.basis : ""}`,
      `Priorité de contact : ${priority.label}. ${priority.reasons.join(" ")}`,
      `Pays répondant au ciblage : ${q.matched.join(", ") || "Aucun pays établi selon les critères"}`,
      `Présence : ${r.presenceType} · ${r.presenceScope}`,
      `Secteur : ${r.sector || r.registryActivity || "À préciser"}`,
      `Siège de l’entité : ${r.hq || "À préciser"}`,
      `Groupe : ${r.groupName || "À préciser"} · siège ${r.groupHQ || "à préciser"}`,
      `CA mondial déclaré : ${revenue(r)} · ${r.revenue.year || "exercice à préciser"} · ${r.revenue.scope}${D.proof(r,"revenue") ? "" : " (à vérifier)"}`,
      op.known ? `Pays déjà couverts par Orange : ${op.covered.join(", ") || "aucun pays renseigné"}.` : "",
      op.known ? `Pays hors couverture Orange renseignée : ${op.open.join(", ") || "Aucun écart identifié"}. Couverture fournie par ${op.source}.` : "Couverture Orange : à valider avec le commercial.",
      `Preuve de présence : ${r.sources.presence || "À établir"}`,
      `Actualité des informations : ${health.filter(x=>x.state !== "current").map(x=>x.label+" — "+x.reason).join(" ; ") || "Toutes les sources suivies ont une consultation récente."}`,
      `Suivi : ${r.commercialStatus}${r.nextActionDate ? " · prochaine action "+displayDate(r.nextActionDate) : ""}`,
      r.commercialNotes ? `Notes commerciales : ${r.commercialNotes}` : "",
      "Questions pour le contact : quels pays sont déjà accompagnés par Orange ? Quels besoins de connectivité ou de sécurité existent dans les autres implantations ? Qui pilote ces sujets ?",
    ].filter(Boolean).join("\n");
  }
  async function saveCommercial(id,patch) {
    const prior=research(id), r=D.validateResearch({...prior,name:prior.name || clients[id]?.name || "",...patch});
    r.history=[...prior.history,{at:new Date().toISOString(),event:"Suivi commercial",previous:{selected:prior.selected,commercialStatus:prior.commercialStatus,nextActionDate:prior.nextActionDate,commercialNotes:prior.commercialNotes}}];
    overrides[id]=r;await persist();render();
  }
  $("tableBody").addEventListener("change",async event=>{
    const checkbox=event.target.closest("[data-select]");
    if (checkbox) await saveCommercial(checkbox.dataset.select,{selected:checkbox.checked});
  });
  $("selectViewBtn").addEventListener("click",async()=>{
    const selected = !visible.every(x=>x.r.selected), entries=[...visible];
    for (const {id,r,name} of entries) overrides[id]=D.validateResearch({...r,name:r.name || name,selected});
    await persist();render();notice(`${entries.length} compte(s) ${selected ? "ajoutés à" : "retirés de"} votre sélection.`);
  });
  $("detailSelectBtn").addEventListener("click",async()=>{
    await saveCommercial(activeId,{selected:!research(activeId).selected});detail(activeId);
  });
  $("prepareContactBtn").addEventListener("click",()=>profileTab("salesPanel"));
  $("commercialForm").addEventListener("submit",async event=>{
    event.preventDefault();const form=event.target;
    try {
      await saveCommercial(activeId,{selected:form.elements.namedItem("selected").checked,
        commercialStatus:form.elements.namedItem("commercialStatus").value,
        nextActionDate:form.elements.namedItem("nextActionDate").value,
        commercialNotes:form.elements.namedItem("commercialNotes").value});
      detail(activeId,"salesPanel");$("copyStatus").textContent="Suivi enregistré.";
    } catch(error) {$("commercialError").textContent=error.message;$("commercialError").hidden=false;}
  });
  $("copyBriefBtn").addEventListener("click",async()=>{
    try {await navigator.clipboard.writeText($("commercialBrief").value);$("copyStatus").textContent="Synthèse copiée.";}
    catch {$("commercialBrief").focus();$("commercialBrief").select();$("copyStatus").textContent="Texte sélectionné : utilisez Ctrl+C ou ⌘C.";}
  });
  function cellValue(cell) {
    const v = cell.value;
    if (v === null || v === undefined) return "";
    if (typeof v !== "object") return v;
    if ("formula" in v || "sharedFormula" in v) return v.result ?? "";
    if (v.richText) return v.richText.map((t) => t.text).join("");
    return v.text || "";
  }
  async function importExcel(file) {
    if (!file || !/\.xlsx$/i.test(file.name)) {
      notice(
        "Sélectionnez un classeur .xlsx. Pour un ancien fichier .xls, enregistrez-le d’abord au format .xlsx.",
        true,
      );
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      notice(
        "Le fichier dépasse 30 Mo. Réduisez-le aux données utiles au portefeuille.",
        true,
      );
      return;
    }
    const input = $("excelInput");
    input.disabled = true;
    $("fileMeta").textContent = "Lecture du classeur…";
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const sheets = wb.worksheets.map((ws) => {
        let headerRow = null;
        ws.eachRow((row, n) => {
          if (headerRow || n > 30) return;
          const values = [];
          row.eachCell({ includeEmpty: true }, (c) =>
            values.push(String(cellValue(c))),
          );
          if (
            values.some((v) => ["siren", "ent siren"].includes(D.norm(v))) &&
            values.some((v) =>
              [
                "raison sociale",
                "ent raison sociale",
                "nom entreprise",
              ].includes(D.norm(v)),
            )
          )
            headerRow = row;
        });
        if (!headerRow) return { name: ws.name, headers: [], rows: [] };
        const labels = [];
        headerRow.eachCell({ includeEmpty: true }, (c, n) => {
          labels[n - 1] = D.text(cellValue(c)) || `Colonne ${n}`;
        });
        const { headers, duplicates } = D.uniqueHeaders(labels);
        const headerIssues = duplicates.length
          ? [
              `En-têtes répétés dans ${ws.name} : ${duplicates.join(", ")}. Import accepté : chaque colonne est conservée séparément avec son numéro. La première occurrence est utilisée par défaut pour les informations reconnues ; les correspondances commerciales restent sélectionnables.`,
            ]
          : [];
        const rows = [];
        ws.eachRow((row, n) => {
          if (n <= headerRow.number) return;
          const obj = Object.assign(Object.create(null), { __row: n });
          headers.forEach((h, i) => (obj[h] = cellValue(row.getCell(i + 1))));
          rows.push(obj);
        });
        return { name: ws.name, headers, rows, headerIssues };
      });
      const result = D.importSheets(sheets);
      clients = result.clients;
      loadedSheets = sheets;
      fileName = file.name;
      page = 1;
      $("scope").querySelectorAll("option").forEach(option => option.disabled = false);
      $("scope").value = "researchedPortfolio";
      $("view").value = "targeted";
      $("fileMeta").textContent =
        `${fileName} · ${Object.keys(clients).length} entreprises importées · Aucune donnée envoyée sur Internet`;
      $("importDiagnostic").hidden = false;
      for (const id of ["mapDirection", "mapSegment"])
        $(id).innerHTML =
          '<option value="">Détection automatique</option>' +
          result.headers
            .map((h) => `<option value="${esc(h)}">${esc(h)}</option>`)
            .join("");
      $("diagnosticContent").innerHTML =
        (result.issues.length
          ? "<ul>" +
            result.issues.map((s) => `<li>${esc(s)}</li>`).join("") +
            "</ul>"
          : "<p>Import effectué sans anomalie détectée.</p>") +
        `<p>Colonnes DEGSE détectées : ${esc(result.headers.join(" · "))}</p><p>AURA / RM et MDM / HDM / SPES sont lus dans les colonnes Excel ; ils ne sont jamais déduits d’un département ou d’une recherche.</p>`;
      populate();
      render();
      notice(
        `Portefeuille importé. ${Object.values(clients).filter((c) => research(c.siren).analyzed).length} entreprise(s) disposent d’une analyse historique ou enregistrée.`,
      );
    } catch (e) {
      notice(
        "Import impossible : " +
          e.message +
          ". Le portefeuille précédent est conservé.",
        true,
      );
      $("fileMeta").textContent = fileName
        ? `${fileName} · portefeuille précédent conservé`
        : "Aucun portefeuille importé. Les recherches historiques restent disponibles.";
    } finally {
      input.disabled = false;
      input.value = "";
    }
  }
  $("excelInput").addEventListener("change", (e) =>
    importExcel(e.target.files[0]),
  );
  $("applyMapping").addEventListener("click", () => {
    try {
      const result = D.importSheets(loadedSheets, {
        direction: $("mapDirection").value,
        segment: $("mapSegment").value,
      });
      clients = result.clients;
      page = 1;
      populate();
      render();
      notice(
        "Correspondance des colonnes appliquée. Les valeurs viennent du fichier Excel, sans déduction géographique.",
      );
    } catch (err) {
      notice(err.message, true);
    }
  });
  for (const type of ["dragover", "dragleave", "drop"])
    $("dropzone").addEventListener(type, (e) => {
      e.preventDefault();
      $("dropzone").classList.toggle("hover", type === "dragover");
      if (type === "drop") importExcel(e.dataTransfer.files[0]);
    });
  function detail(id, panel = "summaryPanel") {
    activeId = id;
    const c = clients[id],
      r = research(id),
      q = D.qualify(r, criteria),
      op = D.opportunities(c, r);
    const health = D.sourceHealth(r,todayParis()), priority = D.contactPriority(c,r,criteria,todayParis(),q,health);
    const matrix = D.coverageMatrix(c,r,criteria,q);
    $("prospectingDetail").innerHTML = `<div class="priority-heading"><h3>Priorité de contact</h3>${badge(priority.label,priority.tone)}</div><ul class="priority-reasons">${priority.reasons.map(reason=>`<li>${esc(reason)}</li>`).join("")}</ul><h3>Implantations et couverture Orange par pays</h3><p class="muted">${esc(op.known ? `Couverture déclarée : ${op.source}. Une absence dans cette liste est une piste à valider avec le commercial.` : "La couverture Orange est inconnue : aucun pays n’est considéré comme non couvert.")} Les listes de présence peuvent être partielles ; « non établie » ne signifie pas absence d’implantation.</p><p class="muted">Périmètre des recherches : ${esc(r.presenceScope)} · ${esc(r.presenceType)}.${r.sources.presence ? ` ${link(r.sources.presence,"Source de présence")}` : ""}</p><div class="country-matrix-scroll" tabindex="0" aria-label="Matrice des implantations et de la couverture Orange"><table class="country-matrix"><caption class="visually-hidden">Présence documentée ou à corroborer, couverture Orange et prochaine vérification par pays</caption><thead><tr><th scope="col">Pays / ciblage</th><th scope="col">Recherche · présence</th><th scope="col">Commercial · Orange</th><th scope="col">Prochaine vérification</th></tr></thead><tbody>${matrix.map(row=>`<tr><th scope="row">${esc(row.country)}${sub(row.targeted ? "Pays ciblé" : "Hors ciblage")}</th><td>${esc(row.presence)}</td><td>${esc(row.coverage)}</td><td>${esc(row.action)}</td></tr>`).join("") || '<tr><td colspan="4">Aucun pays nommé disponible. Préciser les implantations pour analyser les pistes internationales.</td></tr>'}</tbody></table></div><button type="button" class="text-button" id="editCoverageBtn">Renseigner ou vérifier la couverture Orange</button>`;
    const healthLabels = {current:"Source récente",missing:"À compléter",undated:"Date à préciser",stale:"À actualiser"};
    const alerts = health.filter(x=>x.state !== "current");
    $("healthSummary").textContent = `Actualité des informations · ${alerts.length ? alerts.length + " point(s) à vérifier" : "sources récentes"}`;
    $("healthDetails").innerHTML = `<dl class="health-grid">${health.map(x=>`<div><dt>${esc(x.label)} · ${badge(healthLabels[x.state],x.state === "current" ? "success" : "warning")}</dt><dd>${esc(x.reason)}${x.date ? sub("Consultation : "+displayDate(x.date)) : ""}${x.field === "revenue" && r.revenue.year ? sub("Exercice : "+r.revenue.year) : ""}${x.source ? link(x.source,"Consulter la source") : ""}</dd></div>`).join("")}</dl>`;
    $("detailName").textContent = c?.name || r.name || `Entreprise · ${id}`;
    $("detailIdentity").textContent =
      `SIREN ${id} · ${c ? "Dans le portefeuille importé" : "Hors portefeuille importé"}`;
    $("qualificationDetail").innerHTML = `${badge(q.status,q.tone)} ${q.basis ? badge(q.basis) : ""}<p>${esc(q.status === "Cible confirmée" ? `Présence répondant au ciblage : ${q.matched.join(", ")}.` : q.reasons[0] || "Recherche à effectuer.")}</p>${q.reasons.length > 1 ? `<details><summary>Voir les points à vérifier</summary><ul>${q.reasons.slice(1).map(reason=>`<li>${esc(reason)}</li>`).join("")}</ul></details>` : ""}<p class="muted">${esc(op.known ? `Orange accompagne : ${op.covered.join(", ") || "aucun pays renseigné"}. Pays hors couverture renseignée : ${op.open.join(", ") || "aucun écart identifié"}.` : "Pays déjà couverts par Orange à valider avec le commercial avant toute proposition.")}</p>`;
    const datedRevenue = `${revenue(r)}${r.revenue.year ? ` · ${r.revenue.year}` : " · exercice à préciser"} · ${r.revenue.scope}`;
    const facts = [
      ["Secteur d’activité détaillé",r.sector || r.registryActivity],
      ["Siège de l’entité cliente",r.hq],
      ["Groupe / siège du groupe",[r.groupName,r.groupHQ].filter(Boolean).join(" · ") || "À préciser"],
      ["Pays établis par la source actuelle",r.documentedCountries === null ? "À corroborer (informations historiques ci-dessous)" : r.documentedCountries.join(", ") || "Liste de pays à préciser"],
      ["Implantations propres documentées",r.operationalCountries === null ? "Ventilation par pays à préciser" : r.operationalCountries.join(", ") || "Aucun pays établi dans cette ventilation"],
      ["Type / périmètre de présence",`${r.presenceType} · ${r.presenceScope}`],
      ["Nombre de pays et périmètre",r.countryCount],
      ["Sites / filiales à l’étranger",r.foreignSites],
      ["CA mondial · année / périmètre",datedRevenue],
    ];
    const historicalCountries = r.countries.filter(country => !(r.documentedCountries || []).includes(country));
    if (historicalCountries.length) facts.push(["Pays historiques / fournis à corroborer", historicalCountries.join(", ")]);
    $("researchOverview").innerHTML = facts.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value || "À préciser")}</dd></div>`).join("") +
      `<div><dt>Preuve de présence</dt><dd>${link(r.sources.presence,"Consulter la source") || "Source à établir"}${r.sources.presence ? sub(`Consultée le ${displayDate(r.sourceDates.presence || r.checkedAt)}`) : ""}</dd></div>`;
    const values = c
      ? [
          ["Direction commerciale", c.direction],
          ["MDM / HDM / SPES", c.segment],
          ["Commercial", c.vrc],
          ["Secteur Excel", c.sector],
          ["Libellé NAF", c.naf],
          ["CA Orange · 12 mois", money(c.caOrange)],
          ["Groupe mentionné dans Excel", c.groupName],
          ["SIREN maison mère", c.groupSiren],
          ["Origine", `${fileName} · ${c.sourceSheet} · ligne ${c.sourceRow}`],
          [
            "Pays accompagnés par Orange",
            c.coverageKnown ? c.coverage.join(", ") : "Non renseigné",
          ],
        ]
      : [
          [
            "Portefeuille",
            "Aucune correspondance dans le fichier importé. Les champs AURA/RM et MDM/HDM/SPES ne sont pas déduits.",
          ],
        ];
    $("excelDetail").innerHTML = values
      .map(
        ([k, v]) =>
          `<div><dt>${esc(k)}</dt><dd>${esc(v || D.UNKNOWN)}</dd></div>`,
      )
      .join("");
    $("rawExcel").innerHTML = c
      ? '<p class="muted">Origine par information : ' +
        esc(
          Object.entries(c.provenance)
            .filter(([, p]) => p.columns.length)
            .map(
              ([k, p]) =>
                `${k} : ${p.sheet}, ligne ${p.row}, ${p.columns.join(" / ")}`,
            )
            .join(" · "),
        ) +
        '</p><div class="raw-data">' +
        Object.entries(c.raw)
          .filter(([k]) => k !== "__row")
          .map(([k, v]) => `<div><strong>${esc(k)}</strong>${esc(v)}</div>`)
          .join("") +
        "</div>" +
        c.detailSources
          .map(
            (s) =>
              `<p class="muted">${esc(s.sheet)} · ligne ${s.row}</p><div class="raw-data">${Object.entries(
                s.values,
              )
                .filter(([k]) => k !== "__row")
                .map(
                  ([k, v]) => `<div><strong>${esc(k)}</strong>${esc(v)}</div>`,
                )
                .join("")}</div>`,
          )
          .join("")
      : '<p class="muted">Pas de ligne Excel.</p>';
    const form = $("researchForm");
    form.reset();
    const data = {
      name: r.name,
      checkedAt: r.checkedAt,
      sector: r.sector,
      hq: r.hq,
      groupRelation: r.groupRelation,
      groupName: r.groupName,
      groupHQ: r.groupHQ,
      presenceScope: r.presenceScope,
      presenceType: r.presenceType,
      countryCount: r.countryCount,
      foreignSites: r.foreignSites,
      presenceDetails: r.presenceDetails,
      franceRevenue: r.franceRevenue,
      worldEmployees: r.worldEmployees,
      followup: r.followup,
      countries: r.countries.join(" ; "),
      documentedCountries: (r.documentedCountries || []).join(" ; "),
      operationalCountries: (r.operationalCountries || []).join(" ; "),
      uncertainCountries: r.uncertainCountries.join("\n"),
      revenueAmount: r.revenue.amount ?? "",
      revenueCurrency: r.revenue.currency,
      revenueYear: r.revenue.year,
      revenueScope: r.revenue.scope,
      revenueReported: r.revenue.reported,
      notes: r.notes,
      coverageCountries: r.coverage.countries.join(" ; "),
      coverageSource: r.coverage.source,
    };
    data.name = r.name || c?.name || "";
    for (const [key, value] of Object.entries(data))
      form.elements.namedItem(key).value = value;
    for (const key of ["hq", "presence", "sector", "revenue", "group"])
      form.elements.namedItem(key + "Source").value = r.sources[key];
    for (const key of ["reviewed", "noSignal"])
      form.elements.namedItem(key).checked = r[key];
    form.elements.namedItem("coverageKnown").checked = r.coverage.known;
    form.elements.namedItem("countryBreakdownKnown").checked = r.documentedCountries !== null || r.operationalCountries !== null;
    form.elements.namedItem("checkedAt").max = new Date()
      .toISOString()
      .slice(0, 10);
    $("legacyDetail").hidden = !r.legacy;
    if (r.legacy) {
      const old = r.legacy.verification || {}, e = r.legacy.enriched || {};
      const merged = {...old,...e};
      $("legacyContent").innerHTML = '<p class="muted">Informations originales conservées. Leur ancienne classification ne vaut pas qualification selon le ciblage actuel.</p><dl class="raw-data">' + [
        ["Secteur",merged.secteurActivite], ["Siège en France (déclaré)",merged.siegeFrance],
        ["Pays déclarés",[...(merged.paysImplantation?.frontaliers || []),...(merged.paysImplantation?.autre || [])].join(", ")],
        ["Nombre de pays",merged.nbPaysImplantation], ["Sites / filiales étrangers",merged.nbSitesFilialesEtranger],
        ["CA mondial déclaré",[merged.caMondial?.montant,merged.caMondial?.annee].filter(v=>v!=null).join(" · ")],
        ["Justification",[old.justification,e.note].filter(Boolean).join(" — ")]
      ].filter(([,v])=>v).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("") + "</dl>" + link(old.source,"Source historique");
    }
    $("formError").hidden = true;
    $("suppliedDetail").hidden = !r.contributions.length;
    const displayValue = (value) => Array.isArray(value) ? value.join(" ; ") :
      value && typeof value === "object" ? (Object.hasOwn(value,"amount") ? `${money(value.amount,value.currency)} · ${value.year || "année à préciser"} · ${value.scope || "périmètre à préciser"}` : Object.values(value).join(" · ")) : value;
    $("registryDetail").hidden = !r.registeredName;
    $("registryDetail").innerHTML = `<span class="section-kicker">REGISTRE OFFICIEL · CONSTAT DU 13/10/2026</span><dl>${[
      ["Nom enregistré / SIREN", `${r.registeredName} · ${r.siren}`],
      ["Pays du siège déclaré", r.registeredCountry], ["État administratif", r.registryState],
      ["Activité déclarée / code NAF", `${r.registryActivity} · ${r.registryNAF}`],
      ["CA des comptes de la société", r.registeredRevenue || "Non disponible dans le registre consulté"],
    ].map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl><p class="muted">Le CA des comptes de la société n'est pas assimilé au CA mondial consolidé du groupe. La géographie de ces comptes n'est pas isolée.</p>${r.registryState === "Fermée" ? '<p class="notice error">Entité fermée : vérifier le compte actif successeur. Le siège affiché est le dernier déclaré.</p>' : ""}<p>${esc(r.researchConclusion)}</p><p class="muted">À compléter / vérifier : ${esc(D.missingInfo(r).join(" · ") || "Champs renseignés, preuves à relire")}</p>${r.publishedRevenue ? `<p>CA publié sans exercice établi : ${esc(r.publishedRevenue)}</p>` : ""}`;
    $("suppliedDetail").innerHTML =
      [...r.contributions].sort((a,b) => (a.kind === "documentary" ? 0 : a.kind === "registry" ? 2 : 1) - (b.kind === "documentary" ? 0 : b.kind === "registry" ? 2 : 1)).map((entry) => {
        const isResearch = ["registry", "documentary"].includes(entry.kind);
        return `<details ${entry.kind === "documentary" ? "open" : ""}><summary>${esc(contributionLabel(entry))}${isResearch ? ` · ${esc(entry.checkedAt)}` : ` · lot ${esc(entry.lot)}, ligne ${esc(entry.line)}`}</summary><p class="muted">${isResearch ? `Sources citées ci-dessous consultées le ${esc(entry.checkedAt)} ; constats limités aux champs décrits dans cette pièce.` : `Reçu le ${esc(entry.receivedOn)}. Date de consultation des sources non fournie ; liens cités par l’utilisateur.`}</p><dl class="raw-data">${Object.entries(entry.originalFields || {}).filter(([key]) => !["line", "siren", "researchConclusion"].includes(key)).map(([key,value]) => `<div><dt>${esc({name:"Entreprise", hq:"Pays du siège de l’entité", countries:"Pays / couverture déclarés", countriesText:"Pays cités", operationalCountries:"Pays avec implantation propre documentée", sector:"Secteur détaillé", countryCount:"Nombre de pays et périmètre", foreignSites:"Sites / filiales à l’étranger", presenceDetails:"Nature de présence publiée", revenueReported:"CA mondial publié", revenue:"CA daté / devise / périmètre", franceRevenue:"CA France publié", worldEmployees:"Effectifs mondiaux", sourceText:"Sources citées", notes:"Justification", groupName:"Groupe",groupHQ:"Siège du groupe",groupRelation:"Appartenance au groupe",presenceScope:"Périmètre de présence",presenceType:"Nature de présence",documentedCountries:"Pays corroborés",publishedRevenue:"CA sans exercice établi",followup:"Recherche à poursuivre"}[key] || key)}</dt><dd>${esc(displayValue(value))}</dd></div>`).join("")}</dl><p>${esc(entry.notes)}</p><p>${(entry.sourceLinks || []).map((source) => link(source.url, source.label)).join(" · ")}</p>${(entry.cautions || []).length ? `<p class="muted">${entry.cautions.map(esc).join("<br>")}</p>` : ""}</details>`;
      }).join("") +
      (r.changes.length ? `<details><summary>Évolutions conservées (${r.changes.length})</summary><p class="muted">Les valeurs précédentes restent dans la sauvegarde JSON et les pièces d’origine.</p></details>` : "");
    const commercial = $("commercialForm");
    commercial.elements.namedItem("selected").checked = r.selected;
    commercial.elements.namedItem("commercialStatus").value = r.commercialStatus;
    commercial.elements.namedItem("nextActionDate").value = r.nextActionDate;
    commercial.elements.namedItem("commercialNotes").value = r.commercialNotes;
    $("commercialBrief").value = commercialBrief(c,r,q,op);
    $("detailSelectBtn").textContent = r.selected ? "Retirer de ma sélection" : "Ajouter à ma sélection";
    $("commercialError").hidden = true;
    $("copyStatus").textContent = "";
    profileTab(panel);
    if (!$("companyDialog").open) $("companyDialog").showModal();
  }
  $("prospectingDetail").addEventListener("click", e => {
    if (e.target.closest("#editCoverageBtn")) {
      profileTab("editPanel");
      $("researchForm").elements.namedItem("coverageCountries").focus();
    }
  });
  $("tableBody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-company]");
    if (b) detail(b.dataset.company,b.dataset.sales ? "salesPanel" : "summaryPanel");
    if (e.target.closest("[data-show-all]")) {$("view").value="all";page=1;render();}
  });
  $("researchForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const f = e.target,
        get = (k) => D.text(f.elements.namedItem(k).value),
        prior = research(activeId),
        r = { ...prior };
      for (const k of [
        "name",
        "checkedAt",
        "sector",
        "hq",
        "groupRelation",
        "groupName",
        "groupHQ",
        "presenceScope",
        "presenceType",
        "notes",
        "countryCount",
        "foreignSites",
        "presenceDetails",
        "franceRevenue",
        "worldEmployees",
        "followup",
      ])
        r[k] = get(k);
      r.hq = D.country(r.hq);
      r.groupHQ = D.country(r.groupHQ);
      r.countries = D.splitCountries(get("countries"));
      const breakdownKnown = f.elements.namedItem("countryBreakdownKnown").checked;
      r.documentedCountries = breakdownKnown ? D.splitCountries(get("documentedCountries")) : null;
      r.operationalCountries = breakdownKnown ? D.splitCountries(get("operationalCountries")) : null;
      r.uncertainCountries = get("uncertainCountries")
        .split("\n")
        .map(D.text)
        .filter(Boolean);
      r.revenue = {
        amount: D.number(get("revenueAmount")),
        currency: get("revenueCurrency"),
        year: get("revenueYear"),
        scope: get("revenueScope"),
        reported: get("revenueReported"),
      };
      r.sources = Object.fromEntries(
        ["hq", "presence", "sector", "revenue", "group"].map((k) => [
          k,
          get(k + "Source"),
        ]),
      );
      r.sourceDates = { ...(prior.sourceDates || {}) };
      for (const field of Object.keys(r.sources)) {
        if (r.checkedAt !== prior.checkedAt || r.sources[field] !== prior.sources[field])
          r.sourceDates[field] = r.checkedAt;
      }
      r.coverage = {
        known: f.elements.namedItem("coverageKnown").checked,
        countries: D.splitCountries(get("coverageCountries")),
        source: get("coverageSource"),
      };
      r.reviewed = f.elements.namedItem("reviewed").checked;
      r.noSignal = f.elements.namedItem("noSignal").checked;
      r.analyzed = true;
      const validated = D.validateResearch(r);
      validated.history = [
        ...prior.history,
        {
          at: new Date().toISOString(),
          previous: (({ history, legacy, ...rest }) => rest)(prior),
        },
      ];
      overrides[activeId] = validated;
      await persist();
      populate();
      render();
      $("companyDialog").close();
      notice(
        "Analyse enregistrée. La qualification a été recalculée ; les données Excel restent inchangées.",
      );
    } catch (err) {
      $("formError").textContent = err.message;
      $("formError").hidden = false;
    }
  });
  async function applyTargeting() {
    const targets = checked("targetCountries");
    if (!targets.length) {
      chips("targetCountries", [...D.BORDER,D.OTHER], criteria.targets);
      notice("Conservez au moins un pays de prospection.", true);
      return;
    }
    criteria = {targets, hq:$("hq").value, minRevenue:Math.max(0,D.number($("minRevenue").value) || 0),
      operationalOnly:$("presenceRule").value === "operational", includeGroups:$("groupRule").value === "include"};
    page = 1;
    render();
    await persist();
  }
  for (const id of ["targetCountries","hq","presenceRule","groupRule"]) $(id).addEventListener("change", applyTargeting);
  $("minRevenue").addEventListener("input", applyTargeting);
  for (const id of ["scope","view","direction","segment","vrc","group"]) $(id).addEventListener("change", () => {
    if (id === "view" && ["unanalysed","selected","due"].includes($("view").value) && Object.keys(clients).length) $("scope").value = "portfolio";
    page = 1; render();
  });
  for (const id of ["search","sector"]) $(id).addEventListener("input", () => {page=1;render();});
  $("metrics").addEventListener("click", e => {
    const button = e.target.closest("[data-view]");
    if (button) {$("view").value=button.dataset.view;page=1;render();}
  });
  $("resetFilters").addEventListener("click", async () => {
    for (const id of ["search","direction","segment","vrc","sector","group","minRevenue"]) $(id).value="";
    criteria={targets:[...D.BORDER],hq:"any",minRevenue:0,operationalOnly:true,includeGroups:true};
    chips("targetCountries",[...D.BORDER,D.OTHER],criteria.targets);
    $("hq").value="any"; $("presenceRule").value="operational"; $("groupRule").value="include";
    $("scope").value=Object.keys(clients).length ? "researchedPortfolio" : "research";
    $("view").value="targeted";page=1;render();await persist();
  });
  for (const button of document.querySelectorAll("[data-close]")) button.addEventListener("click", () => $(button.dataset.close).close());
  $("prevBtn").addEventListener("click", () => {
    page--;
    render();
  });
  $("nextBtn").addEventListener("click", () => {
    page++;
    render();
  });
  for (const b of document.querySelectorAll("[data-sort]"))
    b.addEventListener("click", () => {
      sort = {
        key: b.dataset.sort,
        dir: sort.key === b.dataset.sort ? -sort.dir : 1,
      };
      page = 1;
      render();
    });
  function download(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $("backupBtn").addEventListener("click", () =>
    download(
      JSON.stringify(
        {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          criteria,
          researches: Object.fromEntries(
            dataset()
              .filter((x) => x.r.analyzed || x.r.selected || x.r.commercialStatus !== "Non planifié" || x.r.nextActionDate || x.r.commercialNotes)
              .map((x) => [x.id, x.r]),
          ),
        },
        null,
        2,
      ),
      "degse-recherches-" + new Date().toISOString().slice(0, 10) + ".json",
      "application/json",
    ),
  );
  $("restoreBtn").addEventListener("click", () => $("researchInput").click());
  $("researchInput").addEventListener("change", async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 15 * 1024 * 1024)
        throw Error("Sauvegarde trop volumineuse (maximum 15 Mo).");
      const payload = JSON.parse(await file.text());
      if (
        payload.schemaVersion !== 1 ||
        !payload.researches ||
        typeof payload.researches !== "object" ||
        Array.isArray(payload.researches)
      )
        throw Error("Format de sauvegarde non reconnu.");
      const pending = {};
      for (const [id, value] of Object.entries(payload.researches)) {
        if (id !== value?.siren)
          throw Error("SIREN incohérent dans la sauvegarde.");
        const r = D.validateResearch(value),
          prior = research(id);
        // Une sauvegarde externe ne peut pas attester une relecture locale ; les pièces documentaires embarquées restent vérifiables.
        r.reviewed = false;
        r.legacy = prior.legacy || r.legacy;
        r.history = [
          ...prior.history,
          {
            at: new Date().toISOString(),
            event: "Import de sauvegarde",
            previous: (({ history, legacy, ...rest }) => rest)(prior),
          },
        ];
        pending[id] = r;
      }
      overrides = { ...overrides, ...pending };
      await persist();
      populate();
      render();
      notice(
        `${Object.keys(pending).length} analyse(s) importée(s). Les versions précédentes sont conservées dans l’historique. Les saisies restent à relire ; les cibles documentaires sont recalculées. Le ciblage local est conservé.`,
      );
    } catch (err) {
      notice(
        "Import de sauvegarde refusé : " +
          err.message +
          " Aucune recherche modifiée.",
        true,
      );
    } finally {
      e.target.value = "";
    }
  });
  $("exportBtn").addEventListener("click", () => {
    const headers = ["SIREN","Entreprise","Excel - Direction commerciale","Excel - MDM HDM SPES","Excel - Commercial",
      "Excel - Secteur","Excel - CA Orange 12 mois EUR","Recherche - Secteur détaillé","Recherche - Siège entité",
      "Recherche - Groupe","Recherche - Siège groupe","Recherche - Pays renseignés","Recherche - Pays corroborés",
      "Recherche - Pays avec implantation propre","Recherche - Type présence","Recherche - Périmètre présence",
      "Recherche - Nombre de pays et périmètre","Recherche - Sites ou filiales à l’étranger","Recherche - CA mondial montant",
      "Recherche - CA mondial devise","Recherche - CA mondial exercice","Recherche - CA mondial périmètre",
      "Recherche - CA publié historique","Registre - CA comptes de la société, périmètre distinct","Qualification",
      "Qualification - Pays répondant aux critères","Qualification - Origine","Source présence","Source lien au groupe",
      "Date consultation présence","Couverture Orange renseignée","Pays hors couverture renseignée","Prospection - Sélection",
      "Prospection - Avancement","Prospection - Prochaine action","Prospection - Notes",
      "Prospection - Priorité de contact","Prospection - Justification priorité","Prospection - Pays ciblés hors couverture déclarée",
      "Prospection - Source couverture Orange","Recherche - Alertes actualisation"];
    const rows = visible.map(({id,name,c,r,q,op,priority,health})=>[id,name,c?.direction,c?.segment,c?.vrc,c?.sector,c?.caOrange,
      r.sector,r.hq,r.groupName,r.groupHQ,r.countries.join(" | "),
      r.documentedCountries === null ? "À corroborer" : r.documentedCountries.join(" | "),
      r.operationalCountries === null ? "Ventilation à préciser" : r.operationalCountries.join(" | "),
      r.presenceType,r.presenceScope,r.countryCount,r.foreignSites,r.revenue.amount,r.revenue.currency,r.revenue.year,
      r.revenue.scope,r.revenue.reported || r.publishedRevenue,r.registeredRevenue,q.status,q.matched.join(" | "),q.basis,
      r.sources.presence,r.sources.group,r.sources.presence ? (r.sourceDates.presence || r.checkedAt) : "",
      op.known ? op.covered.join(" | ") : "À valider",op.known ? op.open.join(" | ") : "À valider",
      r.selected ? "Oui" : "Non",r.commercialStatus,r.nextActionDate,r.commercialNotes,
      priority.label,priority.reasons.join(" | "),op.known ? priority.openTargets.join(" | ") : "Couverture inconnue",
      op.known ? op.source : "À valider",health.filter(x=>x.state !== "current").map(x=>`${x.label} : ${x.reason}`).join(" | ")]);
    download("\ufeff"+[headers,...rows].map(row=>row.map(D.csvCell).join(";")).join("\r\n"),
      `degse-prospection-${todayParis()}.csv`,"text/csv;charset=utf-8");
  });
  populate();
  render();
})();
