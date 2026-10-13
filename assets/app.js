/* DEGSE — interface, import local et sauvegardes. Pas d’envoi du portefeuille. */
(() => {
  "use strict";
  const D = window.DEGSE,
    $ = (id) => document.getElementById(id),
    STORAGE = "degse-international-v8";
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
    base = D.addContributions(D.fromLegacy(historical), supplied);
  let overrides = {},
    clients = {},
    loadedSheets = [],
    fileName = "",
    page = 1,
    activeId = "",
    sort = { key: "name", dir: 1 },
    visible = [];
  let criteria = {
    targets: [...D.BORDER],
    hq: "any",
    minRevenue: 0,
    operationalOnly: true,
    includeGroups: true,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
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
      ["any", "France"].includes(c.hq) &&
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
  function persist() {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({ schemaVersion: 1, researches: overrides, criteria }),
      );
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
    return D.unique([
      ...Object.keys(clients),
      ...Object.keys(base),
      ...Object.keys(overrides),
    ]).map((id) => {
      const c = clients[id] || null,
        r = research(id),
        q = D.qualify(r, criteria);
      return {
        id,
        c,
        r,
        q,
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
  chips("countryFilters", [...D.BORDER, D.OTHER]);
  function checked(id) {
    return [...$(id).querySelectorAll("input:checked")].map((el) => el.value);
  }
  function fillSelect(id, values, extra = []) {
    const el = $(id),
      old = el.value;
    el.innerHTML =
      `<option value="">${id === "vrc" || id === "sector" ? "Tous" : "Toutes"}</option>` +
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
    fillSelect(
      "sector",
      rows.flatMap((x) => [x.c?.sector || "", x.r.sector]),
      [["unknown", "Non renseigné"]],
    );
  }
  function filtered() {
    const search = D.norm($("search").value),
      countries = checked("countryFilters"),
      min = D.number($("minRevenue").value);
    return dataset().filter((x) => {
      const { c, r, q, op } = x,
        scope = $("scope").value;
      if (
        (scope === "portfolio" && !c) ||
        (scope === "researchedPortfolio" && (!c || !r.analyzed)) ||
        (scope === "orphan" && c) ||
        (scope === "research" && !r.analyzed)
      )
        return false;
      if (
        search &&
        !D.norm(
          x.name + " " + x.id + " " + r.groupName + " " + (c?.groupName || ""),
        ).includes(search)
      )
        return false;
      if ($("status").value && q.status !== $("status").value) return false;
      if ($("followup").value && D.followupStatus(r) !== $("followup").value)
        return false;
      if ($("analysis").value && r.analyzed !== ($("analysis").value === "yes"))
        return false;
      if (
        countries.length &&
        !D.zones(r.countries).some((p) => countries.includes(p))
      )
        return false;
      for (const field of ["direction", "segment", "vrc"]) {
        const v = $(field).value;
        if (v && (v === "unknown" ? !!c?.[field] : c?.[field] !== v))
          return false;
      }
      const sect = $("sector").value;
      if (
        sect &&
        (sect === "unknown"
          ? !!(r.sector || c?.sector)
          : ![r.sector, c?.sector].includes(sect))
      )
        return false;
      const hq = $("hq").value;
      if (
        (hq === "france" && r.hq !== "France") ||
        (hq === "foreign" && (!r.hq || r.hq === "France")) ||
        (hq === "unknown" && r.hq)
      )
        return false;
      const group = $("group").value;
      if (
        (group === "foreign" &&
          (r.groupRelation !== "Oui" ||
            !r.groupHQ ||
            r.groupHQ === "France")) ||
        (group === "france" &&
          (r.groupRelation !== "Oui" || r.groupHQ !== "France")) ||
        (group === "yes" && r.groupRelation !== "Oui") ||
        (group === "unknown" && r.groupRelation !== "Inconnu" && r.groupHQ)
      )
        return false;
      if (
        min !== null &&
        min > 0 &&
        (r.revenue.amount === null ||
          r.revenue.currency !== "EUR" ||
          r.revenue.amount < min)
      )
        return false;
      if (
        ($("gap").value === "yes" && (!op.known || !op.open.length)) ||
        ($("gap").value === "unknown" && op.known)
      )
        return false;
      return true;
    });
  }
  function revenue(r) {
    return r.revenue.amount !== null
      ? money(r.revenue.amount, r.revenue.currency)
      : r.revenue.reported || "Non communiqué";
  }
  function sortValue(x, key) {
    return {
      name: x.name,
      direction: x.c?.direction,
      vrc: x.c?.vrc,
      caOrange: x.c?.caOrange,
      revenue:
        x.r.revenue.amount !== null && x.r.revenue.currency === "EUR"
          ? x.r.revenue.amount
          : null,
      status: x.q.status,
    }[key];
  }
  function render() {
    visible = filtered().sort((a, b) => {
      const av = sortValue(a, sort.key),
        bv = sortValue(b, sort.key);
      if (av == null || av === "") return bv == null || bv === "" ? 0 : 1;
      if (bv == null || bv === "") return -1;
      return (
        (typeof av === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "fr", { numeric: true })) *
        sort.dir
      );
    });
    const pages = Math.max(1, Math.ceil(visible.length / 40));
    page = Math.min(page, pages);
    const analyzed = visible.filter((x) => x.r.analyzed).length,
      confirmed = visible.filter(
        (x) => x.q.status === "Cible confirmée",
      ).length,
      gaps = visible.filter((x) => x.op.known && x.op.open.length).length;
    $("metrics").innerHTML = [
      {
        n: visible.length,
        label: "Entreprises dans la vue",
        note: `${visible.filter((x) => x.c).length} dans le portefeuille importé`,
      },
      {
        n: analyzed,
        label: "Entreprises analysées",
        note: "Recherche effectuée, qualification indépendante",
      },
      {
        n: confirmed,
        label: "Cibles confirmées",
        note: "Selon les critères et preuves renseignées",
        tone: "success",
      },
      {
        n: gaps,
        label: "Pistes de couverture",
        note: "Pays présents hors couverture Orange connue",
      },
    ]
      .map(
        (x) =>
          `<div class="metric ${x.tone || ""}"><span class="metric-label">${x.label}</span><strong>${x.n.toLocaleString("fr-FR")}</strong><p>${x.note}</p></div>`,
      )
      .join("");
    $("resultCount").textContent =
      `${visible.length.toLocaleString("fr-FR")} entreprise(s) · ${checked("countryFilters").length ? "Présence renseignée, à apprécier selon les preuves" : "Tous pays"} · Critères : ${criteria.targets.join(", ")}`;
    $("tableBody").innerHTML =
      visible
        .slice((page - 1) * 40, page * 40)
        .map((x) => {
          const { c, r, q, op } = x;
          const groupInfo =
            r.groupRelation === "Oui"
              ? `${r.groupName || "Groupe non nommé"} · ${r.groupHQ || "siège non renseigné"}`
              : r.groupRelation === "Non"
                ? "Pas de groupe renseigné"
                : "Groupe à documenter";
          return `<tr><td><button class="company-link" data-company="${x.id}">${esc(x.name)}</button>${sub(x.id)}${!c ? badge("Hors portefeuille importé") : c.duplicate ? badge("Doublon Excel", "warning") : ""}</td><td>${esc(c?.direction || D.UNKNOWN)}${sub(c?.segment || "MDM / HDM / SPES non renseigné")}</td><td>${esc(c?.vrc || D.UNKNOWN)}</td><td>${esc(c?.sector || D.UNKNOWN)}</td><td>${esc(c ? money(c.caOrange) : D.UNKNOWN)}${sub("CA de la relation Orange")}</td><td>${r.countries.length ? r.countries.map((p) => `<span class="country-label">${esc(p)}</span>`).join("") : esc(D.UNKNOWN)}${sub(`${r.presenceScope} · ${r.presenceType}`)}${r.uncertainCountries.length ? badge("Mentions incertaines", "warning") : ""}</td><td>${esc(r.sector || D.UNKNOWN)}</td><td>${esc(r.hq || D.UNKNOWN)}${sub(groupInfo)}${r.hq && !D.proof(r, "hq") ? badge("Siège à sourcer", "warning") : ""}</td><td>${esc(revenue(r))}${sub(`${r.revenue.year || "Exercice non renseigné"} · ${r.revenue.scope}`)}${r.revenue.reported && r.revenue.amount === null ? badge("Montant historique", "warning") : ""}</td><td>${badge(r.analyzed ? "Analysé" : "Non analysé", r.analyzed ? "blue" : "neutral")}${sub(r.checkedAt || "Date non renseignée")}${sub(D.followupStatus(r))}${r.contributions.length ? badge("Complément utilisateur", "blue") : ""}${r.reviewed ? sub("Analyse relue") : r.analyzed ? sub("À revalider") : ""}${link(r.sources.presence, "Présence") || (r.legacy?.verification?.source ? link(r.legacy.verification.source, "Source historique") : "")}</td><td>${badge(q.status, q.tone)}${sub(q.reasons[0] || "Critères satisfaits")}</td><td>${op.known ? esc(op.open.join(", ") || "Aucun écart identifié") : "Couverture Orange à renseigner"}${sub(op.known ? "Pistes à valider commercialement" : "Aucune opportunité déduite automatiquement")}</td></tr>`;
        })
        .join("") ||
      '<tr><td colspan="12" class="empty">Aucune entreprise ne correspond aux filtres. Réinitialisez-les ou importez le portefeuille.</td></tr>';
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
      $("scope").value = "portfolio";
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
  function detail(id) {
    activeId = id;
    const c = clients[id],
      r = research(id),
      q = D.qualify(r, criteria),
      op = D.opportunities(c, r);
    $("detailName").textContent = c?.name || r.name || `Entreprise · ${id}`;
    $("detailIdentity").textContent =
      `SIREN ${id} · ${c ? "Dans le portefeuille importé" : "Hors portefeuille importé"}`;
    $("qualificationDetail").innerHTML =
      `${badge(q.status, q.tone)} ${badge(r.analyzed ? "Analysé" : "Non analysé", "blue")}<ul>${q.reasons.map((s) => `<li>${esc(s)}</li>`).join("") || "<li>Présence documentée, analyse relue et critères satisfaits.</li>"}</ul><p>${esc(op.known ? `Orange accompagne : ${op.covered.join(", ") || "aucun pays renseigné"}. Pays à examiner : ${op.open.join(", ") || "aucun écart identifié"}. Source : ${op.source}` : "Les pays déjà accompagnés par Orange sont inconnus. La présence mondiale seule ne suffit pas à établir un écart de couverture.")}</p>`;
    $("qualificationDetail").innerHTML +=
      `<p><strong>Suivi : ${esc(D.followupStatus(r))}</strong><br>${esc(D.missingInfo(r).length ? "Informations à compléter ou préciser : " + D.missingInfo(r).join(" · ") : "Les principaux champs sont renseignés ; cela ne constitue pas une confirmation commerciale.")}</p>`;
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
    form.elements.namedItem("checkedAt").max = new Date()
      .toISOString()
      .slice(0, 10);
    $("legacyDetail").hidden = !r.legacy;
    if (r.legacy) {
      const old = r.legacy.verification || {},
        e = r.legacy.enriched || {};
      $("legacyContent").innerHTML =
        '<p class="muted">Données reprises du fichier d’origine. L’ancien statut n’est pas une confirmation selon les critères actuels. Les valeurs d’origine restent conservées dans la sauvegarde.</p><div class="legacy-note">' +
        esc(JSON.stringify(r.legacy, null, 2)) +
        "</div>" +
        link(old.source, "Ouvrir la source historique");
      if (e.aVerifier || old.classification === "PROBABLE")
        $("legacyContent").innerHTML +=
          '<p class="muted">Des incertitudes étaient déjà signalées dans le fichier d’origine.</p>';
    }
    $("formError").hidden = true;
    $("suppliedDetail").hidden = !r.contributions.length;
    $("suppliedDetail").innerHTML =
      r.contributions
        .map(
          (entry) =>
            `<h3>Complément utilisateur · lot ${esc(entry.lot)}, ligne ${esc(entry.line)}</h3><p class="muted">Reçu le ${esc(entry.receivedOn)}. Date de consultation des sources non fournie ; liens cités, sans nouvelle vérification Internet.</p><dl class="raw-data">${Object.entries(
              entry.originalFields || {},
            )
              .filter(([key]) => !["line", "siren"].includes(key))
              .map(
                ([key, value]) =>
                  `<div><dt>${esc({ name: "Entreprise", hq: "Siège de l’entité en France", countries: "Pays / couverture déclarés", sector: "Secteur détaillé", countryCount: "Nombre de pays et périmètre", foreignSites: "Sites / filiales à l’étranger", presenceDetails: "Nature de présence publiée", revenueReported: "CA mondial publié", franceRevenue: "CA France publié", worldEmployees: "Effectifs mondiaux", sourceText: "Sources citées", notes: "Justification" }[key] || key)}</dt><dd>${esc(value)}</dd></div>`,
              )
              .join(
                "",
              )}</dl><p>${(entry.sourceLinks || []).map((source) => link(source.url, source.label)).join(" · ")}</p>${(entry.cautions || []).length ? `<p class="muted">${entry.cautions.map(esc).join("<br>")}</p>` : ""}`,
        )
        .join("") +
      (r.changes.length
        ? `<details><summary>Différences conservées avec les informations précédentes</summary><div class="legacy-note">${esc(JSON.stringify(r.changes, null, 2))}</div></details>`
        : "");
    $("companyDialog").showModal();
  }
  $("tableBody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-company]");
    if (b) detail(b.dataset.company);
  });
  $("researchForm").addEventListener("submit", (e) => {
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
      persist();
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
  $("methodBtn").addEventListener("click", () => {
    chips("targetCountries", [...D.BORDER, D.OTHER], criteria.targets);
    const f = $("criteriaForm");
    f.elements.namedItem("hq").value = criteria.hq;
    f.elements.namedItem("minRevenue").value = criteria.minRevenue;
    f.elements.namedItem("operationalOnly").checked = criteria.operationalOnly;
    f.elements.namedItem("includeGroups").checked = criteria.includeGroups;
    $("methodDialog").showModal();
  });
  $("criteriaForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const targets = checked("targetCountries");
    if (!targets.length) {
      notice("Sélectionnez au moins un pays dans les critères.", true);
      return;
    }
    const f = e.target;
    criteria = {
      targets,
      hq: f.elements.namedItem("hq").value,
      minRevenue: D.number(f.elements.namedItem("minRevenue").value) || 0,
      operationalOnly: f.elements.namedItem("operationalOnly").checked,
      includeGroups: f.elements.namedItem("includeGroups").checked,
    };
    persist();
    render();
    $("methodDialog").close();
    notice(
      "Critères appliqués à toutes les entreprises. Le filtre pays réduit la vue ; les critères définissent la confirmation.",
    );
  });
  for (const b of document.querySelectorAll("[data-close]"))
    b.addEventListener("click", () => $(b.dataset.close).close());
  for (const id of [
    "scope",
    "status",
    "analysis",
    "direction",
    "segment",
    "vrc",
    "sector",
    "hq",
    "group",
    "gap",
    "countryFilters",
    "followup",
  ])
    $(id).addEventListener("change", () => {
      page = 1;
      render();
    });
  for (const id of ["search", "minRevenue"])
    $(id).addEventListener("input", () => {
      page = 1;
      render();
    });
  $("resetFilters").addEventListener("click", () => {
    for (const id of [
      "search",
      "status",
      "analysis",
      "direction",
      "segment",
      "vrc",
      "sector",
      "hq",
      "group",
      "minRevenue",
      "gap",
      "followup",
    ])
      $(id).value = "";
    $("scope").value = Object.keys(clients).length ? "portfolio" : "all";
    for (const c of $("countryFilters").querySelectorAll("input"))
      c.checked = false;
    page = 1;
    render();
  });
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
              .filter((x) => x.r.analyzed)
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
        // Un import externe ne peut pas attester une relecture locale des preuves.
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
      persist();
      populate();
      render();
      notice(
        `${Object.keys(pending).length} analyse(s) importée(s). Les versions précédentes sont conservées dans l’historique. Les preuves doivent être relues avant confirmation. Les critères locaux sont conservés.`,
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
    const headers = [
      "SIREN",
      "Entreprise",
      "Dans portefeuille",
      "Excel - Direction commerciale",
      "Excel - MDM HDM SPES",
      "Excel - Commercial",
      "Excel - Secteur",
      "Excel - CA Orange 12 mois EUR",
      "Recherche - Secteur",
      "Recherche - Pays du siège entité",
      "Recherche - Groupe",
      "Recherche - Pays du siège groupe",
      "Recherche - Présence mondiale",
      "Recherche - Périmètre présence",
      "Recherche - Type présence",
      "Recherche - CA mondial montant",
      "Recherche - CA mondial devise",
      "Recherche - CA mondial exercice",
      "Recherche - CA mondial périmètre",
      "Recherche - CA publié historique",
      "Statut analyse",
      "Qualification",
      "Motifs qualification",
      "Couverture Orange connue",
      "Pays Orange",
      "Pays à examiner",
      "Source présence",
      "Source siège",
      "Source groupe",
      "Source secteur",
      "Source CA mondial",
      "Date consultation",
      "Notes",
      "Recherche - Nombre de pays et périmètre",
      "Recherche - Sites ou filiales à l’étranger",
      "Recherche - Précisions présence",
      "Recherche - CA France publié",
      "Recherche - Effectifs mondiaux",
      "Suivi recherches",
      "Informations manquantes",
      "Lots utilisateur",
      "Liens cités dans les lots",
    ];
    const rows = visible.map(({ id, name, c, r, q, op }) => [
      id,
      name,
      c ? "Oui" : "Non",
      c?.direction,
      c?.segment,
      c?.vrc,
      c?.sector,
      c?.caOrange,
      r.sector,
      r.hq,
      r.groupName,
      r.groupHQ,
      r.countries.join(" | "),
      r.presenceScope,
      r.presenceType,
      r.revenue.amount,
      r.revenue.currency,
      r.revenue.year,
      r.revenue.scope,
      r.revenue.reported,
      r.analyzed ? "Analysé" : "Non analysé",
      q.status,
      q.reasons.join(" | "),
      op.known ? "Oui" : "Non",
      op.covered.join(" | "),
      op.known ? op.open.join(" | ") : "Couverture inconnue",
      r.sources.presence,
      r.sources.hq,
      r.sources.group,
      r.sources.sector,
      r.sources.revenue,
      r.checkedAt,
      r.notes,
      r.countryCount,
      r.foreignSites,
      r.presenceDetails,
      r.franceRevenue,
      r.worldEmployees,
      D.followupStatus(r),
      D.missingInfo(r).join(" | "),
      r.contributions.map((e) => e.id).join(" | "),
      r.contributions
        .flatMap((e) => e.sourceLinks || [])
        .map((source) => source.url)
        .join(" | "),
    ]);
    download(
      "\ufeff" +
        [headers, ...rows]
          .map((row) => row.map(D.csvCell).join(";"))
          .join("\r\n"),
      "degse-opportunites-" + new Date().toISOString().slice(0, 10) + ".csv",
      "text/csv;charset=utf-8",
    );
  });
  populate();
  render();
})();
