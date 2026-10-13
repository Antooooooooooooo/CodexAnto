/* DEGSE — modèle métier. Aucune distance géographique ne qualifie une cible. */
(function (root) {
  "use strict";
  const BORDER = ["Italie", "Suisse", "Luxembourg", "Belgique", "Allemagne"];
  const OTHER = "International — Autre";
  const UNKNOWN = "Non renseigné";
  const norm = (v) =>
    String(v ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const text = (v) => String(v ?? "").trim();
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
      sector: "",
      hq: "",
      groupName: "",
      groupHQ: "",
      groupRelation: "Inconnu",
      presenceScope: "Inconnu",
      presenceType: "Inconnue",
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
      r.legacy = { verification: v, enriched: e, excluded: r.noSignal };
      // Les preuves historiques ne sont pas affectées arbitrairement à chaque champ.
      result[id] = r;
    }
    return result;
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
    return !!safeURL(r.sources?.[field]) && validDate(r.checkedAt);
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
      matches = r.countries.filter((c) =>
        criteria.targets.includes(BORDER.includes(c) ? c : OTHER),
      );
    if (r.noSignal && matches.length)
      reasons.push(
        "Résultats contradictoires : présence ciblée renseignée et absence de signal cochée.",
      );
    if (!r.reviewed) reasons.push("Analyse à relire et preuves à valider.");
    if (!proof(r, "presence"))
      reasons.push("Source et date de présence internationale requises.");
    if (!matches.length)
      (r.reviewed && (r.noSignal || r.countries.length) && proof(r, "presence")
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
      ["Distribution", "Export"].includes(r.presenceType)
    ) {
      const i = reasons.indexOf("Implantation opérationnelle non établie.");
      if (i !== -1) reasons.splice(i, 1);
    }
    if (r.presenceScope === "Groupe") {
      if (!criteria.includeGroups)
        excluded.push("Présence au niveau du groupe hors critères.");
      else if (r.groupRelation !== "Oui" || !r.groupName || !proof(r, "group"))
        reasons.push("Lien de l’entité avec le groupe à documenter.");
    } else if (r.presenceScope !== "Entreprise")
      reasons.push("Périmètre entreprise / groupe à établir.");
    if (criteria.hq === "France") {
      if (!r.hq || !proof(r, "hq"))
        reasons.push("Siège de l’entité à documenter.");
      else if (r.hq !== "France")
        excluded.push("Siège de l’entité hors de France.");
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
    }
    const status =
      excluded.length && r.reviewed
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
      matched: matches,
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
        ? (r?.countries || []).filter(
            (p) => !covered.includes(p) && p !== "France",
          )
        : [],
      source: c?.coverageKnown ? "Excel" : r?.coverage?.source || "",
    };
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
    ])
      r[k] = text(raw[k]);
    for (const k of ["analyzed", "reviewed", "noSignal"])
      r[k] = raw[k] === true;
    for (const [key, allowed] of Object.entries({
      groupRelation: ["Oui", "Non", "Inconnu"],
      presenceScope: ["Entreprise", "Groupe", "Inconnu"],
      presenceType: [
        "Implantation",
        "Mixte",
        "Distribution",
        "Export",
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
    uniqueHeaders,
    importSheets,
    qualify,
    opportunities,
    proof,
    validDate,
    validateResearch,
    csvCell,
  };
  root.DEGSE = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
