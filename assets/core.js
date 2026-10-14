/* DEGSE — modèle métier. Aucune distance géographique ne qualifie une cible. */
(function (root) {
  "use strict";
  const BORDER = ["Italie", "Suisse", "Luxembourg", "Belgique", "Allemagne"];
  const OTHER = "International — Autre";
  const UNKNOWN = "Non renseigné";
  const COMMERCIAL_STATES = ["Non planifié", "À contacter", "Contacté", "Rendez-vous prévu", "À écarter"];
  // Seules les pièces embarquées alimentent la qualification documentaire automatique.
  const VERIFIED_SOURCES = new Map();
  const norm = (v) =>
    String(v ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const text = (v) => String(v ?? "").trim();
  const revenueYear = (v) => Number(text(v).match(/(?:19|20)\d{2}/)?.[0] || 0);
  const unique = (a) => [...new Set(a.filter(Boolean))];
  const siren = (v) => {
    const s = text(v).replace(/\s/g, "");
    return /^\d{1,9}$/.test(s) ? s.padStart(9, "0") : "";
  };
  const safeURL = (v) => {
    try {
      const u = new URL(text(v));
      return ["https:", "http:"].includes(u.protocol) &&
        !u.username &&
        !u.password
        ? u.href
        : "";
    } catch {
      return "";
    }
  };
  function number(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const s = text(v)
      .replace(/[\s\u00a0\u202f€]/g, "")
      .replace(",", ".");
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  }
  const ISO_CODES =
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
      " ",
    );
  const namesFR = new Intl.DisplayNames(["fr"], { type: "region" }),
    namesEN = new Intl.DisplayNames(["en"], { type: "region" });
  const COUNTRY_NAMES = new Map();
  for (const code of ISO_CODES)
    for (const alias of [code, namesFR.of(code), namesEN.of(code)])
      COUNTRY_NAMES.set(norm(alias), namesFR.of(code));
  for (const [alias, code] of Object.entries({
    USA: "US",
    UK: "GB",
    "Corée du Sud": "KR",
    "Corée du Nord": "KP",
    Russie: "RU",
    Turquie: "TR",
    "République tchèque": "CZ",
    "Hong Kong": "HK",
    Émirats: "AE",
    "Emirats arabes unis": "AE",
  }))
    COUNTRY_NAMES.set(norm(alias), namesFR.of(code));
  const knownCountry = (v) => COUNTRY_NAMES.has(norm(v));
  const country = (v) => COUNTRY_NAMES.get(norm(v)) || text(v);
  const splitCountries = (v) =>
    unique((Array.isArray(v) ? v : text(v).split(/[;,\n]/)).map(country));
  const zones = (countries) =>
    unique(
      countries
        .filter((c) => c !== "France")
        .map((c) => (BORDER.includes(c) ? c : OTHER)),
    );
  function emptyResearch(id) {
    return {
      siren: id,
      name: "",
      analyzed: false,
      reviewed: false,
      noSignal: false,
      selected: false,
      commercialStatus: "Non planifié",
      nextActionDate: "",
      commercialNotes: "",
      sector: "",
      hq: "",
      groupName: "",
      groupHQ: "",
      groupRelation: "Inconnu",
      presenceScope: "Inconnu",
      presenceType: "Inconnue",
      countryCount: "",
      foreignSites: "",
      presenceDetails: "",
      franceRevenue: "",
      worldEmployees: "",
      followup: "",
      registeredName: "",
      registeredCountry: "",
      registryState: "",
      registryNAF: "",
      registryActivity: "",
      registeredRevenue: "",
      researchConclusion: "",
      publishedRevenue: "",
      // null : ancienne recherche sans ventilation ; [] : aucun pays établi par la nouvelle source.
      documentedCountries: null,
      operationalCountries: null,
      contributions: [],
      changes: [],
      countries: [],
      uncertainCountries: [],
      revenue: {
        amount: null,
        currency: "EUR",
        year: "",
        scope: "Inconnu",
        reported: "",
      },
      sources: { hq: "", presence: "", sector: "", revenue: "", group: "" },
      sourceDates: {},
      checkedAt: "",
      notes: "",
      coverage: { known: false, countries: [], source: "" },
      history: [],
      legacy: null,
    };
  }
  function fromLegacy(raw) {
    const result = {};
    for (const id of unique([
      ...Object.keys(raw.verification || {}),
      ...Object.keys(raw.enriched || {}),
      ...(raw.excluded || []),
    ])) {
      const v = raw.verification?.[id] || {},
        e = raw.enriched?.[id] || {},
        merged = { ...v, ...e },
        r = emptyResearch(id);
      r.analyzed = true;
      r.noSignal = (raw.excluded || []).includes(id);
      r.sector = merged.secteurActivite || "";
      r.hq = merged.siegeFrance === "Oui" ? "France" : "";
      r.presenceType =
        {
          Opérationnelle: "Implantation",
          Mixte: "Mixte",
          Commerciale: "Distribution",
        }[merged.typePresence] || "Inconnue";
      const all = [
        ...(merged.paysImplantation?.frontaliers || []),
        ...(merged.paysImplantation?.autre || []),
      ];
      r.uncertainCountries = all.filter((c) => !knownCountry(c));
      r.countries = unique(
        all
          .filter((c) => !r.uncertainCountries.includes(c))
          .map(country)
          .filter((c) => c !== "France"),
      );
      r.revenue.reported =
        merged.caMondial?.montant == null ? "" : text(merged.caMondial.montant);
      r.revenue.year = text(merged.caMondial?.annee);
      r.revenue.scope = /groupe/.test(merged.caMondial?.statut || "")
        ? "Groupe"
        : "Inconnu";
      r.notes = unique([v.justification, e.note]).join("\n");
      r.countryCount = text(merged.nbPaysImplantation);
      r.foreignSites = text(merged.nbSitesFilialesEtranger);
      r.presenceDetails = text(merged.typePresence);
      r.franceRevenue =
        merged.caFrance?.montant == null
          ? ""
          : `${merged.caFrance.montant}${merged.caFrance.annee ? " — " + merged.caFrance.annee : ""}`;
      r.worldEmployees =
        merged.effectifsMondiaux?.nombre == null
          ? ""
          : `${merged.effectifsMondiaux.nombre}${merged.effectifsMondiaux.annee ? " — " + merged.effectifsMondiaux.annee : ""}`;
      r.legacy = { verification: v, enriched: e, excluded: r.noSignal };
      // Les preuves historiques ne sont pas affectées arbitrairement à chaque champ.
      result[id] = r;
    }
    return result;
  }
  const EXTRA_FIELDS = [
    "countryCount",
    "foreignSites",
    "presenceDetails",
    "franceRevenue",
    "worldEmployees",
    "followup",
    "registeredName",
    "registeredCountry",
    "registryState",
    "registryNAF",
    "registryActivity",
    "registeredRevenue",
    "researchConclusion",
    "publishedRevenue",
  ];
  function addContributions(records, supplied) {
    const result = structuredClone(records);
    for (const entry of supplied.records || []) {
      if (["registry", "documentary"].includes(entry.kind)) VERIFIED_SOURCES.set(entry.id, entry);
      const r = result[entry.siren] || emptyResearch(entry.siren);
      const applied = new Set();
      for (const [field, value] of Object.entries(entry.fields)) {
        if (field === "countriesText") continue;
        if (
          ![
            ...EXTRA_FIELDS,
            "name",
            "sector",
            "hq",
            "groupName",
            "groupHQ",
            "groupRelation",
            "presenceScope",
            "presenceType",
            "revenue",
            "documentedCountries",
            "operationalCountries",
          ].includes(field)
        )
          continue;
        // Un rapport ancien enrichit l'archive sans écraser un exercice plus récent fourni par l'utilisateur.
        if (field === "revenue" && revenueYear(r.revenue.year) > revenueYear(value.year)) {
          r.changes.push({field, previous: value, current: r.revenue, source: entry.id,
            note: "Chiffre vérifié plus ancien conservé dans les pièces ; exercice récent non revalidé par cette source."});
          continue;
        }
        if (
          JSON.stringify(r[field]) !== JSON.stringify(value) &&
          r[field] !== "" &&
          r[field] !== "Inconnu" &&
          r[field] !== "Inconnue"
        )
          r.changes.push({
            field,
            previous: r[field],
            current: value,
            source: entry.id,
          });
        r[field] = structuredClone(value);
        if (["documentedCountries", "operationalCountries"].includes(field) && Array.isArray(value))
          r[field] = unique(value.map(country));
        applied.add(field);
      }
      if (Object.hasOwn(entry.fields, "countriesText")) {
        const tokens = text(entry.fields.countriesText)
          .replace(/Autre\s*:/gi, "")
          .split(/[;,]/)
          .map(text)
          .filter(Boolean);
        const suppliedCountries = unique(
          tokens.filter(knownCountry).map(country).filter((p) => p !== "France"),
        );
        const nextCountries = entry.mergeCountries
          ? unique([...r.countries, ...suppliedCountries]) : suppliedCountries;
        if (JSON.stringify(r.countries) !== JSON.stringify(nextCountries) && r.countries.length)
          r.changes.push({
            field: "countries", previous: r.countries, current: nextCountries, source: entry.id,
          });
        r.countries = nextCountries;
        r.uncertainCountries = unique([
          ...r.uncertainCountries,
          ...tokens.filter((p) => !knownCountry(p)),
        ]);
        if (entry.kind === "documentary") {
          r.documentedCountries = suppliedCountries;
          if (suppliedCountries.length && r.noSignal) {
            r.changes.push({field: "noSignal", previous: true, current: false, source: entry.id});
            r.noSignal = false;
          }
        }
      }
      r.sourceDates = r.sourceDates || {};
      for (const [field, url] of Object.entries(entry.fieldSources || {})) {
        // Le code NAF prouve l'activité déclarée, pas une description historique plus détaillée.
        if (field === "sector" && !applied.has("sector")) continue;
        if (field === "revenue" && !applied.has("revenue")) continue;
        if (Object.hasOwn(r.sources, field) && safeURL(url) && validDate(entry.checkedAt)) {
          r.sources[field] = url;
          r.sourceDates[field] = entry.checkedAt;
        }
      }
      if (validDate(entry.checkedAt)) r.checkedAt = entry.checkedAt;
      r.contributions.push(structuredClone(entry));
      r.notes = unique([
        r.notes,
        `${entry.kind ? entry.lot : `Lot ${entry.lot}, ligne ${entry.line}`} : ${entry.notes}`,
        ...(entry.cautions || []),
      ]).join("\n");
      r.analyzed = true;
      r.reviewed = false;
      // Les lignes omises d’un lot ne sont jamais assimilées à des recherches négatives.
      result[entry.siren] = r;
    }
    for (const item of supplied.followups || []) {
      const r = result[item.siren] || emptyResearch(item.siren);
      r.followup = item.followup;
      r.notes = unique([r.notes, item.reason]).join("\n");
      result[item.siren] = r;
    }
    return result;
  }
  function reconcileResearch(base, saved) {
    if (!saved) return base;
    const missing = base.contributions.filter(
      (e) => !(saved.contributions || []).some((old) => old.id === e.id),
    );
    const fillExtras = EXTRA_FIELDS.some(
      (field) => !saved[field] && base[field],
    );
    if (!missing.length && !fillExtras) return saved;
    const r = structuredClone(saved);
    r.contributions = [...(r.contributions || []), ...structuredClone(missing)];
    r.changes = r.changes || [];
    // Les nouveaux constats du registre restent disponibles même si une saisie locale diffère.
    for (const field of ["registeredName", "registeredCountry", "registryState", "registryNAF",
      "registryActivity", "registeredRevenue", "researchConclusion", "publishedRevenue"])
      if (missing.length && base[field]) r[field] = base[field];
    for (const field of ["documentedCountries", "operationalCountries"])
      if (missing.length && base[field] !== null) {
        r[field] = structuredClone(base[field]);
        r.countries = unique([...r.countries, ...base[field]]);
      }
    if (
      missing.length &&
      !r.noSignal &&
      !r.countries.length &&
      base.countries.length
    )
      r.countries = structuredClone(base.countries);
    if (
      missing.length &&
      r.revenue.amount === null &&
      !r.revenue.reported &&
      !r.revenue.year &&
      base.revenue.amount !== null
    )
      r.revenue = structuredClone(base.revenue);
    if (missing.length && JSON.stringify(r.revenue) !== JSON.stringify(base.revenue))
      r.changes.push({field: "revenue", previous: base.revenue, current: r.revenue,
        source: "Saisie locale conservée ; nouveau constat disponible dans les pièces"});
    for (const field of [
      ...EXTRA_FIELDS,
      ...(missing.length
        ? ["name", "sector", "hq", "groupName", "groupHQ"]
        : []),
    ]) {
      if (!r[field] && base[field]) r[field] = base[field];
      else if (missing.length && base[field] && r[field] !== base[field])
        r.changes.push({
          field,
          previous: base[field],
          current: r[field],
          source: "Saisie locale conservée ; nouveau complément disponible",
        });
    }
    r.sourceDates = r.sourceDates || {};
    for (const field of Object.keys(base.sources)) {
      const equal = field === "presence"
        ? JSON.stringify(r.documentedCountries) === JSON.stringify(base.documentedCountries)
        : field === "group"
          ? r.groupName === base.groupName && r.groupHQ === base.groupHQ && r.groupRelation === base.groupRelation
          : JSON.stringify(r[field]) === JSON.stringify(base[field]);
      if (missing.length && base.sources[field] && !r.sources[field] && equal) {
        r.sources[field] = base.sources[field];
        r.sourceDates[field] = base.sourceDates[field] || base.checkedAt;
      }
    }
    r.notes = unique([
      r.notes,
      ...missing.flatMap((e) => [`${e.kind ? e.lot : `Lot ${e.lot}, ligne ${e.line}`} : ${e.notes}`, ...(e.cautions || [])]),
    ]).join("\n");
    if (missing.length) r.reviewed = false;
    return r;
  }
  function missingInfo(r) {
    const missing = [];
    if (!r.hq) missing.push("Siège de l’entité");
    if (!r.sector) missing.push("Secteur détaillé");
    if (!r.countries.length || r.uncertainCountries.length)
      missing.push("Pays de présence à préciser");
    if (
      !r.countryCount ||
      /non communique|transition|historique/.test(norm(r.countryCount))
    )
      missing.push("Nombre de pays");
    if (
      !r.foreignSites ||
      /non communique|non confirme|non isole|non publie|non donne|a confirmer|aucun.*confirm|exact.*entite/.test(
        norm(r.foreignSites),
      )
    )
      missing.push("Sites / filiales à l’étranger");
    if (r.presenceType === "Inconnue") missing.push("Type de présence");
    if (r.documentedCountries !== null && !r.documentedCountries.length)
      missing.push("Pays précis à corroborer par une source liée au client");
    if (r.revenue.amount === null)
      missing.push(r.revenue.reported ? "CA mondial historique à vérifier / structurer" : "CA mondial");
    if (r.revenue.amount !== null && r.revenue.currency === "Autre")
      missing.push("Devise du CA mondial");
    if (r.revenue.amount !== null && r.revenue.scope === "Inconnu")
      missing.push("Périmètre du CA mondial");
    if (!r.revenue.year) missing.push("Exercice du CA mondial");
    return missing;
  }
  function followupStatus(r) {
    return (
      r.followup ||
      (missingInfo(r).length ? "À compléter" : "Enrichissement renseigné")
    );
  }
  const ALIASES = {
    siren: ["SIREN", "ENT. SIREN"],
    name: ["Raison Sociale", "ENT. Raison Sociale", "Nom entreprise"],
    direction: [
      "Direction commerciale",
      "DC",
      "Direction",
      "Direction commerciale libellé",
      "DC Libellé",
      "Libellé Direction commerciale",
    ],
    segment: [
      "MDM HDM SPES",
      "MDM / HDM / SPES",
      "Marché",
      "Marche",
      "Marché Libellé",
      "Catégorie commerciale",
      "Segment commercial",
      "Segment",
      "Seg Nationale Libellé",
      "Seg Locale Libellé",
    ],
    vrc: ["Nom et prénom VRC", "VRC", "Commercial", "AM"],
    sector: [
      "Macro-sect. Nat. Libellé",
      "Secteur activité",
      "Secteur d’activité",
      "Secteur",
      "Libellé NAF",
    ],
    naf: ["Libellé NAF"],
    caOrange: ["CA GLOBAL 12 mois", "CA Orange 12 mois", "CA Orange"],
    groupName: ["GRP. Raison Sociale", "Groupe", "Maison mère"],
    groupSiren: ["GRP. SIREN Maison Mère"],
    coverage: [
      "Pays couverts par Orange",
      "Pays Orange",
      "Pays accompagnés par Orange",
    ],
  };
  function uniqueHeaders(values) {
    const labels = Array.from(
      values,
      (value, i) => text(value) || `Colonne ${i + 1}`,
    );
    const reserved = new Set(labels.map(norm));
    const used = new Set([norm("__row")]);
    const duplicates = [];
    const headers = labels.map((label, i) => {
      let key = label;
      if (used.has(norm(key))) {
        duplicates.push(label);
        key = `${label} [colonne ${i + 1}]`;
        let suffix = 2;
        while (reserved.has(norm(key)) || used.has(norm(key))) {
          key = `${label} [colonne ${i + 1}, ${suffix++}]`;
        }
      }
      used.add(norm(key));
      return key;
    });
    return { headers, duplicates: unique(duplicates) };
  }
  function columns(headers) {
    const map = {};
    for (const [field, aliases] of Object.entries(ALIASES)) {
      map[field] = aliases
        .map((a) => headers.find((h) => norm(h) === norm(a)))
        .filter(Boolean);
    }
    return map;
  }
  const pick = (row, keys) =>
    (keys || [])
      .map((k) => row[k])
      .find((v) => v !== null && v !== undefined && text(v) !== "") ?? "";
  function importSheets(sheets, mapping = {}) {
    const main = sheets.find((s) => norm(s.name) === "degse");
    if (!main)
      throw Error(
        "L’onglet DEGSE est requis. Onglets trouvés : " +
          sheets.map((s) => s.name).join(", "),
      );
    if (!main.rows.length) throw Error("L’onglet DEGSE est vide.");
    const cols = columns(main.headers);
    for (const key of ["direction", "segment"])
      if (mapping[key]) {
        if (!main.headers.includes(mapping[key]))
          throw Error("Colonne de correspondance absente : " + mapping[key]);
        cols[key] = [mapping[key]];
      }
    if (!cols.siren.length || !cols.name.length)
      throw Error(
        "Colonnes obligatoires absentes : SIREN et/ou Raison Sociale.",
      );
    const clients = {},
      issues = sheets.flatMap((sheet) => sheet.headerIssues || []),
      duplicates = new Set();
    let invalid = 0;
    for (const row of main.rows) {
      const id = siren(pick(row, cols.siren));
      if (!id || !text(pick(row, cols.name))) {
        invalid++;
        continue;
      }
      if (clients[id]) {
        duplicates.add(id);
        continue;
      }
      const dcRaw = text(pick(row, cols.direction));
      const segments = unique(
        cols.segment
          .map((k) => text(row[k]))
          .filter((v) => /^(mdm|hdm|spes)$/i.test(v))
          .map((v) => v.toUpperCase()),
      );
      clients[id] = {
        siren: id,
        name: text(pick(row, cols.name)),
        direction: /^(aura|rm)$/i.test(dcRaw) ? dcRaw.toUpperCase() : dcRaw,
        segment: segments.length === 1 ? segments[0] : "",
        segmentRaw: cols.segment
          .map((k) => text(row[k]))
          .filter(Boolean)
          .join(" / "),
        vrc: text(pick(row, cols.vrc)),
        sector: text(pick(row, cols.sector)),
        naf: text(pick(row, cols.naf)),
        caOrange: number(pick(row, cols.caOrange)),
        groupName: text(pick(row, cols.groupName)),
        groupSiren: siren(pick(row, cols.groupSiren)),
        coverage: splitCountries(pick(row, cols.coverage)),
        coverageKnown: !!text(pick(row, cols.coverage)),
        sourceSheet: main.name,
        sourceRow: row.__row ?? null,
        sourceColumns: cols,
        raw: row,
        duplicate: false,
      };
      clients[id].provenance = Object.fromEntries(
        Object.entries(cols).map(([field, keys]) => [
          field,
          { sheet: main.name, row: row.__row ?? null, columns: keys },
        ]),
      );
      clients[id].detailSources = [];
      if (clients[id].coverage.some((p) => !knownCountry(p))) {
        clients[id].coverageKnown = false;
        issues.push(
          `SIREN ${id} : couverture Orange non exploitable, certains pays ne sont pas explicites.`,
        );
      }
      if (segments.length > 1)
        issues.push(`SIREN ${id} : catégories MDM/HDM/SPES contradictoires.`);
    }
    for (const s of sheets.filter((s) => norm(s.name) === "detail clients")) {
      const cs = columns(s.headers);
      for (const row of s.rows) {
        const c = clients[siren(pick(row, cs.siren))];
        if (!c) continue;
        let used = false;
        for (const key of ["groupName", "groupSiren", "direction"])
          if (!c[key] && text(pick(row, cs[key]))) {
            c[key] =
              key === "groupSiren"
                ? siren(pick(row, cs[key]))
                : text(pick(row, cs[key]));
            c.provenance[key] = {
              sheet: s.name,
              row: row.__row ?? null,
              columns: cs[key],
            };
            used = true;
          }
        if (!c.segment) {
          const value = cs.segment
            .map((k) => text(row[k]))
            .find((v) => /^(mdm|hdm|spes)$/i.test(v));
          if (value) {
            c.segment = value.toUpperCase();
            c.provenance.segment = {
              sheet: s.name,
              row: row.__row ?? null,
              columns: cs.segment,
            };
            used = true;
          }
        }
        if (used)
          c.detailSources.push({
            sheet: s.name,
            row: row.__row ?? null,
            values: row,
          });
      }
    }
    for (const id of duplicates) clients[id].duplicate = true;
    if (duplicates.size)
      issues.push(
        `${duplicates.size} SIREN en doublon : première ligne conservée, aucune somme automatique. Vérifier les lignes source.`,
      );
    if (invalid)
      issues.push(
        `${invalid} ligne(s) ignorée(s) : SIREN ou raison sociale invalide / absent.`,
      );
    for (const key of ["direction", "segment", "caOrange", "sector"])
      if (!cols[key].length)
        issues.push(
          `Information Excel non reconnue : ${key === "direction" ? "direction commerciale AURA / RM" : key === "segment" ? "catégorie MDM / HDM / SPES" : key === "caOrange" ? "CA Orange 12 mois" : "secteur d’activité"}.`,
        );
    if (!Object.keys(clients).length)
      throw Error("Aucune entreprise exploitable dans DEGSE.");
    return {
      clients,
      issues,
      duplicates: duplicates.size,
      invalid,
      headers: main.headers,
    };
  }
  function validDate(s) {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s &&
      s <= new Date().toISOString().slice(0, 10)
    );
  }
  function proof(r, field) {
    const date = Object.hasOwn(r.sourceDates || {}, field) ? r.sourceDates[field] : r.checkedAt;
    return !!safeURL(r.sources?.[field]) && validDate(date);
  }
  function documentaryProof(r, field) {
    if (!proof(r, field)) return false;
    const sameCountries = (a, b) => JSON.stringify(splitCountries(a || []).filter(c => c !== "France").sort()) ===
      JSON.stringify(splitCountries(b || []).filter(c => c !== "France").sort());
    return (r.contributions || []).some(receipt => {
      const entry = VERIFIED_SOURCES.get(receipt.id);
      if (!entry || entry.siren !== r.siren || entry.fieldSources?.[field] !== r.sources[field] ||
          entry.checkedAt !== (r.sourceDates?.[field] || r.checkedAt)) return false;
      const f = entry.fields;
      if (field === "presence") {
        if (!Object.hasOwn(f, "countriesText") || !sameCountries(f.countriesText, r.documentedCountries)) return false;
        return ["presenceScope", "presenceType"].every(k => !Object.hasOwn(f, k) || f[k] === r[k]) &&
          (!Object.hasOwn(f, "operationalCountries") || sameCountries(f.operationalCountries, r.operationalCountries));
      }
      if (field === "group") return f.groupRelation === "Oui" &&
        ["groupName", "groupHQ", "groupRelation"].every(k => !Object.hasOwn(f, k) || f[k] === r[k]);
      if (field === "revenue") return f.revenue &&
        ["amount", "currency", "year", "scope"].every(k => f.revenue[k] === r.revenue[k]);
      return Object.hasOwn(f, field) && f[field] === r[field];
    });
  }
  function qualify(r, criteria) {
    if (!r?.analyzed)
      return {
        status: "Non analysé",
        tone: "neutral",
        reasons: ["Recherche à effectuer."],
        matched: [],
      };
    const reasons = [],
      excluded = [],
      matches = (r.documentedCountries ?? r.countries).filter((c) =>
        criteria.targets.includes(BORDER.includes(c) ? c : OTHER),
      );
    if (r.noSignal && matches.length)
      reasons.push(
        "Résultats contradictoires : présence ciblée renseignée et absence de signal cochée.",
      );
    const documented = documentaryProof(r, "presence");
    if (!r.reviewed && !documented) reasons.push("Présence à valider : recherche historique ou source non vérifiée.");
    if (r.registryState === "Fermée")
      reasons.push("Entité fermée au registre : vérifier le compte actif successeur avant qualification.");
    if (!proof(r, "presence"))
      reasons.push("Source et date de présence internationale requises.");
    if (!matches.length)
      ((r.reviewed || documented) && (r.noSignal || r.countries.length) && proof(r, "presence")
        ? excluded
        : reasons
      ).push("Aucune présence documentée dans les pays ciblés.");
    if (!["Implantation", "Mixte"].includes(r.presenceType))
      (criteria.operationalOnly &&
      ["Distribution", "Export"].includes(r.presenceType)
        ? excluded
        : reasons
      ).push("Implantation opérationnelle non établie.");
    if (
      !criteria.operationalOnly &&
      ["Distribution", "Export", "Réseau de partenaires"].includes(r.presenceType)
    ) {
      const i = reasons.indexOf("Implantation opérationnelle non établie.");
      if (i !== -1) reasons.splice(i, 1);
    }
    if (criteria.operationalOnly && r.operationalCountries !== null &&
        !matches.some((c) => (r.operationalCountries || []).includes(c)))
      reasons.push("Aucun pays ciblé avec implantation propre documentée dans la ventilation par pays.");
    if (criteria.operationalOnly && r.presenceType === "Mixte" && r.operationalCountries == null)
      reasons.push("Préciser les pays avec implantation propre pour cette présence mixte.");
    if (r.presenceScope === "Groupe") {
      if (!criteria.includeGroups)
        excluded.push("Présence au niveau du groupe hors critères.");
      else if (r.groupRelation !== "Oui" || !r.groupName || !proof(r, "group"))
        reasons.push("Lien de l’entité avec le groupe à documenter.");
      else if (!r.reviewed && !documentaryProof(r, "group"))
        reasons.push("Lien au groupe à valider pour l’entité cliente.");
    } else if (r.presenceScope === "Réseau de partenaires") {
      if (criteria.operationalOnly) excluded.push("Présence par partenaires indépendants hors critères opérationnels.");
    } else if (r.presenceScope !== "Entreprise")
      reasons.push("Périmètre entreprise / groupe à établir.");
    if (criteria.hq === "France") {
      if (!r.hq || !proof(r, "hq"))
        reasons.push("Siège de l’entité à documenter.");
      else if (r.hq !== "France")
        excluded.push("Siège de l’entité hors de France.");
      else if (!r.reviewed && !documentaryProof(r, "hq")) reasons.push("Siège français à valider.");
    } else if (criteria.hq === "foreign") {
      if (!r.hq || !proof(r, "hq")) reasons.push("Siège hors France à documenter.");
      else if (r.hq === "France") excluded.push("Siège de l’entité en France.");
      else if (!r.reviewed && !documentaryProof(r, "hq")) reasons.push("Siège hors France à valider.");
    }
    if (criteria.minRevenue > 0) {
      if (
        r.revenue.amount === null ||
        r.revenue.currency !== "EUR" ||
        !proof(r, "revenue") ||
        !/^(Entreprise|Groupe)$/.test(r.revenue.scope) ||
        !/^\d{4}$/.test(r.revenue.year)
      )
        reasons.push(
          "CA mondial daté, sourcé et exprimé en EUR requis pour le seuil.",
        );
      else if (r.revenue.amount < criteria.minRevenue)
        excluded.push("CA mondial inférieur au seuil.");
      else if (!r.reviewed && !documentaryProof(r, "revenue")) reasons.push("CA mondial à valider pour appliquer le seuil.");
    }
    const status =
      excluded.length && (r.reviewed || documented)
        ? "Hors critères"
        : reasons.length
          ? "À qualifier"
          : "Cible confirmée";
    return {
      status,
      tone:
        status === "Cible confirmée"
          ? "success"
          : status === "Hors critères"
            ? "neutral"
            : "warning",
      reasons: [...excluded, ...reasons],
      matched: criteria.operationalOnly && r.operationalCountries !== null
        ? matches.filter(c => (r.operationalCountries || []).includes(c)) : matches,
      basis: status === "Cible confirmée" ? (r.reviewed ? "Relecture analyste" : "Recherche documentaire") : "",
    };
  }
  function opportunities(c, r) {
    const known = c?.coverageKnown || r?.coverage?.known;
    const covered = c?.coverageKnown
      ? c.coverage
      : r?.coverage?.countries || [];
    return {
      known: !!known,
      covered,
      open: known
        ? (r?.documentedCountries ?? r?.countries ?? []).filter(
            (p) => !covered.includes(p) && p !== "France",
          )
        : [],
      source: c?.coverageKnown ? "Excel" : r?.coverage?.source || "",
    };
  }
  // Indicateurs d’aide à la prospection, recalculés sans modifier la qualification.
  function sourceHealth(r, today = new Date().toISOString().slice(0, 10)) {
    const fields = [
      ["presence", "Présence internationale", !!(r.documentedCountries ?? r.countries).length || r.noSignal],
      ["hq", "Siège de l’entité", !!r.hq],
      ["sector", "Secteur d’activité", !!(r.sector || r.registryActivity)],
      ["revenue", "CA mondial", r.revenue.amount !== null || !!(r.revenue.reported || r.publishedRevenue)],
    ];
    if (r.groupRelation === "Oui" || r.presenceScope === "Groupe" || r.groupName)
      fields.push(["group", "Lien au groupe", r.groupRelation === "Oui" && !!r.groupName]);
    return fields.map(([field, label, valueKnown]) => {
      const source = safeURL(r.sources?.[field]);
      const date = Object.hasOwn(r.sourceDates || {}, field) ? r.sourceDates[field] : r.checkedAt;
      const dateOK = /^\d{4}-\d{2}-\d{2}$/.test(date || "") &&
        !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date && date <= today;
      const age = dateOK ? Math.floor((Date.parse(today) - Date.parse(date)) / 86400000) : null;
      let state = "current", reason = "Source consultée au cours des 365 derniers jours.";
      if (!valueKnown || !source) {
        state = "missing";
        reason = !valueKnown ? "Information à renseigner." : "Source de cette information à renseigner.";
      } else if (!dateOK) {
        state = "undated"; reason = "Date de consultation à préciser.";
      } else if (age > 365) {
        state = "stale"; reason = "Source consultée il y a plus d’un an : vérifier que le fait reste actuel.";
      }
      if (field === "revenue" && valueKnown && state === "current") {
        const year = /^\d{4}$/.test(r.revenue.year) ? Number(r.revenue.year) : 0;
        if (!year || year > Number(today.slice(0, 4))) {
          state = "undated"; reason = "Exercice du CA mondial à préciser.";
        } else if (year < Number(today.slice(0, 4)) - 2) {
          state = "stale"; reason = "Exercice du CA mondial ancien : rechercher un exercice plus récent.";
        }
      }
      return {field, label, state, reason, date: dateOK ? date : "", source};
    });
  }
  function coverageMatrix(c, r, criteria, q = qualify(r, criteria)) {
    const op = opportunities(c, r), countries = unique([
      ...criteria.targets.filter(p => p !== OTHER), ...r.countries,
      ...(r.documentedCountries || []), ...(r.operationalCountries || []), ...(op.known ? op.covered : []),
    ]).filter(knownCountry).sort((a,b) => {
      const targeted = p => p !== "France" && criteria.targets.includes(BORDER.includes(p) ? p : OTHER);
      return Number(targeted(b)) - Number(targeted(a)) || a.localeCompare(b,"fr");
    });
    const validated = (r.reviewed || documentaryProof(r,"presence")) && proof(r,"presence");
    return countries.map(country => {
      const targeted = country !== "France" && criteria.targets.includes(BORDER.includes(country) ? country : OTHER);
      const listed = (r.documentedCountries ?? r.countries).includes(country);
      const historical = r.countries.includes(country) && !listed;
      const own = r.operationalCountries !== null ? r.operationalCountries.includes(country) : r.presenceType === "Implantation" && listed;
      const presence = listed && validated ? (own ? "Implantation propre documentée" : "Présence documentée · " + r.presenceType)
        : listed || historical ? "Présence à corroborer" : "Présence non établie";
      const covered = op.known && op.covered.includes(country);
      const eligible = q.status === "Cible confirmée" && q.matched.includes(country);
      const action = !targeted ? "Hors ciblage" : !eligible ? "Présence / critères à valider"
        : !op.known ? "Valider la couverture Orange" : covered ? "Pas d’écart déclaré" : "Piste d’extension à valider";
      return {country, targeted, presence, eligible, coverage: !op.known ? "Inconnue" : covered ? "Couvert (déclaré)" : "Absent de la liste renseignée", action};
    });
  }
  function contactPriority(c, r, criteria, today = new Date().toISOString().slice(0, 10), q = qualify(r, criteria), health = sourceHealth(r, today)) {
    const op = opportunities(c, r), openTargets = op.known && q.status === "Cible confirmée" ? q.matched.filter(p => !op.covered.includes(p)) : [];
    const result = (label, rank, tone, reasons) => ({label, rank, tone, reasons, openTargets});
    if (r.registryState === "Fermée") return result("Entité fermée", 9, "neutral", ["Vérifier le compte actif successeur avant toute prospection."]);
    if (r.commercialStatus === "À écarter") return result("Compte écarté", 8, "neutral", ["Le suivi commercial indique de ne pas poursuivre ce compte."]);
    if (q.status === "Hors critères") return result("Hors ciblage", 7, "neutral", q.reasons);
    if (q.status !== "Cible confirmée") return result("Dossier à compléter", 4, "warning", q.reasons);
    const critical = ["presence", ...(r.presenceScope === "Groupe" ? ["group"] : []),
      ...(criteria.hq !== "any" ? ["hq"] : []), ...(criteria.minRevenue > 0 ? ["revenue"] : [])];
    const stale = health.filter(x => critical.includes(x.field) && x.state !== "current");
    if (stale.length) return result("Informations à actualiser", 3, "warning", stale.map(x => `${x.label} : ${x.reason}`));
    const due = r.nextActionDate && r.nextActionDate <= today;
    const schedule = due ? ["Prochaine action arrivée à échéance."] : [];
    if (!op.known) return result("Couverture à valider", due ? .5 : 1, "warning",
      [...schedule, "Présence ciblée documentée ; pays déjà accompagnés par Orange inconnus. Un échange avec le commercial est pertinent."]);
    if (openTargets.length) return result("Contact à préparer", due ? -.5 : 0, "success",
      [...schedule, `${openTargets.join(", ")} : présence ciblée documentée, hors liste de couverture Orange renseignée (${op.source}). Besoin et contrat à vérifier.`]);
    return result("Pas d’écart ciblé", 5, "neutral", [...schedule, "Tous les pays répondant au ciblage figurent dans la couverture Orange déclarée. D’autres besoins peuvent exister."]);
  }
  function validateResearch(raw) {
    if (
      !raw ||
      typeof raw !== "object" ||
      !siren(raw.siren) ||
      text(raw.siren).length !== 9
    )
      throw Error("SIREN de recherche invalide.");
    const r = emptyResearch(raw.siren);
    for (const k of [
      "name",
      "sector",
      "hq",
      "groupName",
      "groupHQ",
      "notes",
      "checkedAt",
      "nextActionDate",
      "commercialNotes",
      ...EXTRA_FIELDS,
    ])
      r[k] = text(raw[k]);
    for (const k of ["analyzed", "reviewed", "noSignal"])
      r[k] = raw[k] === true;
    r.selected = raw.selected === true;
    r.commercialStatus = raw.commercialStatus || "Non planifié";
    if (!COMMERCIAL_STATES.includes(r.commercialStatus)) throw Error("Suivi commercial invalide.");
    if (r.nextActionDate && (!/^\d{4}-\d{2}-\d{2}$/.test(r.nextActionDate) ||
        Number.isNaN(Date.parse(r.nextActionDate)) || new Date(r.nextActionDate).toISOString().slice(0, 10) !== r.nextActionDate))
      throw Error("Date de prochaine action invalide.");
    for (const [key, allowed] of Object.entries({
      groupRelation: ["Oui", "Non", "Inconnu"],
      presenceScope: ["Entreprise", "Groupe", "Réseau de partenaires", "Inconnu"],
      presenceType: [
        "Implantation",
        "Mixte",
        "Distribution",
        "Export",
        "Réseau de partenaires",
        "Inconnue",
      ],
    })) {
      if (!allowed.includes(raw[key])) throw Error("Valeur invalide : " + key);
      r[key] = raw[key];
    }
    for (const k of ["countries", "uncertainCountries"]) {
      if (!Array.isArray(raw[k]) || raw[k].some((v) => typeof v !== "string"))
        throw Error("Liste de pays invalide.");
      r[k] = unique(raw[k].map(country)).filter((c) => c !== "France");
    }
    if (r.countries.some((v) => !knownCountry(v)))
      throw Error(
        "Pays non reconnu : utilisez un nom de pays explicite ou un code ISO (ex. Italie / IT). Déplacez les mentions incertaines dans les notes.",
      );
    for (const key of ["documentedCountries", "operationalCountries"]) {
      if (raw[key] == null) continue;
      if (!Array.isArray(raw[key]) || raw[key].some((v) => typeof v !== "string" || !knownCountry(v)))
        throw Error("Ventilation des pays invalide : " + key);
      r[key] = unique(raw[key].map(country)).filter((p) => p !== "France");
      if (r[key].some((p) => !r.countries.includes(p)))
        throw Error("La ventilation doit être comprise dans les pays de présence : " + key);
    }
    for (const key of ["hq", "groupHQ"]) {
      if (r[key] && !knownCountry(r[key]))
        throw Error("Pays du siège non reconnu : " + key);
      r[key] = country(r[key]);
    }
    r.revenue = {
      amount: raw.revenue?.amount == null ? null : number(raw.revenue.amount),
      currency: text(raw.revenue?.currency || "EUR"),
      year: text(raw.revenue?.year),
      scope: text(raw.revenue?.scope || "Inconnu"),
      reported: text(raw.revenue?.reported),
    };
    if (
      !["EUR", "USD", "CHF", "GBP", "Autre"].includes(r.revenue.currency) ||
      !["Entreprise", "Groupe", "Inconnu"].includes(r.revenue.scope) ||
      (r.revenue.amount !== null && r.revenue.amount < 0)
    )
      throw Error("CA mondial invalide.");
    for (const key of Object.keys(r.sources)) {
      const value = text(raw.sources?.[key]);
      if (value && !safeURL(value))
        throw Error("URL de source invalide : " + key);
      r.sources[key] = value;
    }
    if (r.checkedAt && !validDate(r.checkedAt))
      throw Error("Date de consultation invalide ou future.");
    for (const key of Object.keys(r.sources)) {
      if (!Object.hasOwn(raw.sourceDates || {}, key)) continue;
      const date = text(raw.sourceDates[key]);
      if (date && !validDate(date)) throw Error("Date de preuve invalide : " + key);
      r.sourceDates[key] = date;
    }
    r.coverage = {
      known: raw.coverage?.known === true,
      countries: splitCountries(raw.coverage?.countries || []),
      source: text(raw.coverage?.source),
    };
    if (r.coverage.countries.some((v) => !knownCountry(v)))
      throw Error("Pays de couverture Orange non reconnu.");
    if (r.coverage.known && !r.coverage.source)
      throw Error("Préciser la source commerciale de la couverture Orange.");
    r.history = Array.isArray(raw.history) ? raw.history : [];
    r.legacy = raw.legacy && typeof raw.legacy === "object" ? raw.legacy : null;
    for (const key of ["contributions", "changes"])
      r[key] = Array.isArray(raw[key]) ? raw[key] : [];
    if (
      ![
        "",
        "À compléter",
        "À rechercher par l’utilisateur",
        "À relire",
        "Enrichissement renseigné",
      ].includes(r.followup)
    )
      throw Error("Suivi de recherche invalide.");
    return r;
  }
  const csvCell = (v) => {
    let s = text(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const api = {
    BORDER,
    OTHER,
    UNKNOWN,
    COMMERCIAL_STATES,
    norm,
    text,
    unique,
    siren,
    safeURL,
    number,
    country,
    knownCountry,
    splitCountries,
    zones,
    emptyResearch,
    fromLegacy,
    addContributions,
    reconcileResearch,
    missingInfo,
    followupStatus,
    uniqueHeaders,
    importSheets,
    qualify,
    opportunities,
    sourceHealth,
    coverageMatrix,
    contactPriority,
    proof,
    documentaryProof,
    validDate,
    validateResearch,
    csvCell,
  };
  root.DEGSE = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
