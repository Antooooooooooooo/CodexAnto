"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const D = require("../assets/core.js");
const criteria = {
  targets: [...D.BORDER],
  hq: "any",
  minRevenue: 0,
  operationalOnly: true,
  includeGroups: true,
};
function researched() {
  const r = D.emptyResearch("012345678");
  Object.assign(r, {
    analyzed: true,
    reviewed: true,
    presenceScope: "Entreprise",
    presenceType: "Implantation",
    countries: ["Italie", "Chine"],
    checkedAt: "2026-01-12",
    sources: { ...r.sources, presence: "https://example.com/locations" },
  });
  return r;
}
test("Migration : toutes les recherches conservées, aucune ancienne confirmation reconduite", () => {
  const legacy = JSON.parse(
    fs.readFileSync(
      require("node:path").join(
        __dirname,
        "../data/recherches-historiques.json",
      ),
    ),
  );
  const records = D.fromLegacy(legacy);
  assert.equal(Object.keys(records).length, 721);
  for (const [id, r] of Object.entries(records)) {
    assert.equal(r.analyzed, true);
    assert.equal(r.reviewed, false);
    assert.notEqual(D.qualify(r, criteria).status, "Cible confirmée");
    D.validateResearch(r);
    if (legacy.verification[id])
      assert.deepEqual(r.legacy.verification, legacy.verification[id]);
  }
});
test("Pays : cinq zones ciblées, Espagne et Chine classées Autre, Pays-Bas conservés", () => {
  assert.deepEqual(
    D.zones(["France", "Allemagne", "Espagne", "Chine", "Suisse"]),
    ["Allemagne", D.OTHER, "Suisse"],
  );
  assert.equal(D.country("USA"), "États-Unis");
  assert.equal(D.country("IT"), "Italie");
  assert.ok(D.knownCountry("Pays-Bas"));
  assert.equal(D.knownCountry("Europe à confirmer"), false);
});
test("Siège étranger accepté par défaut et siège français exigible explicitement", () => {
  const r = researched();
  r.hq = "Finlande";
  r.sources.hq = "https://example.com/hq";
  assert.equal(D.qualify(r, criteria).status, "Cible confirmée");
  assert.equal(
    D.qualify(r, { ...criteria, hq: "France" }).status,
    "Hors critères",
  );
  r.hq = "France";
  r.sources.hq = "";
  assert.equal(
    D.qualify(r, { ...criteria, hq: "France" }).status,
    "À qualifier",
  );
});
test("Une analyse, une URL ou une proximité frontalière seules ne confirment pas une cible", () => {
  const r = researched();
  r.reviewed = false;
  assert.equal(D.qualify(r, criteria).status, "À qualifier");
  r.reviewed = true;
  r.sources.presence = "";
  assert.equal(D.qualify(r, criteria).status, "À qualifier");
  r.sources.presence = "https://example.com";
  r.checkedAt = "";
  assert.equal(D.qualify(r, criteria).status, "À qualifier");
  r.checkedAt = "2026-01-12";
  r.noSignal = true;
  assert.equal(D.qualify(r, criteria).status, "À qualifier");
  assert.equal(
    D.qualify(D.emptyResearch("012345678"), criteria).status,
    "Non analysé",
  );
});
test("Distribution et export séparés des implantations opérationnelles", () => {
  const r = researched();
  r.presenceType = "Distribution";
  assert.equal(D.qualify(r, criteria).status, "Hors critères");
  assert.equal(
    D.qualify(r, { ...criteria, operationalOnly: false }).status,
    "Cible confirmée",
  );
});
test("Présence du groupe : lien documenté nécessaire, filiale française distincte du groupe étranger", () => {
  const r = researched();
  Object.assign(r, {
    hq: "France",
    presenceScope: "Groupe",
    groupRelation: "Oui",
    groupName: "Groupe exemple",
    groupHQ: "Finlande",
  });
  assert.equal(D.qualify(r, criteria).status, "À qualifier");
  r.sources.group = "https://example.com/group";
  assert.equal(D.qualify(r, criteria).status, "Cible confirmée");
  assert.equal(
    D.qualify(r, { ...criteria, includeGroups: false }).status,
    "Hors critères",
  );
});
test("Pays autre possible dans les critères, présence inconnue non confirmée", () => {
  const r = researched();
  r.countries = ["Chine"];
  assert.equal(D.qualify(r, criteria).status, "Hors critères");
  assert.equal(
    D.qualify(r, { ...criteria, targets: [D.OTHER] }).status,
    "Cible confirmée",
  );
});
test("CA mondial : null distinct de zéro, devises et périmètres préservés", () => {
  const r = researched(),
    c = { ...criteria, minRevenue: 1000000 };
  assert.equal(D.qualify(r, c).status, "À qualifier");
  r.revenue = {
    amount: 2000000,
    currency: "CHF",
    year: "2024",
    scope: "Groupe",
  };
  r.sources.revenue = "https://example.com/report";
  assert.equal(D.qualify(r, c).status, "À qualifier");
  r.revenue.currency = "EUR";
  assert.equal(D.qualify(r, c).status, "Cible confirmée");
  r.revenue.amount = 0;
  assert.equal(D.qualify(r, c).status, "Hors critères");
  assert.equal(D.number(""), null);
  assert.equal(D.number("0"), 0);
  assert.equal(D.number("1 234,5 €"), 1234.5);
});
test("Import Excel : SIREN avec zéro initial, aucun siège ou catégorie déduit du département", () => {
  const row = {
    SIREN: 12345678,
    "Raison Sociale": "Client",
    Département: "74",
    "Seg Nationale Libellé": "Autre",
    "CA GLOBAL 12 mois": 0,
  };
  const data = D.importSheets([
    { name: "DEGSE", headers: Object.keys(row), rows: [row] },
  ]);
  assert.equal(data.clients["012345678"].caOrange, 0);
  assert.equal(data.clients["012345678"].direction, "");
  assert.equal(data.clients["012345678"].segment, "");
  assert.equal(data.clients["012345678"].hq, undefined);
});
test("Import : AURA/RM et MDM/HDM/SPES lus depuis Excel, groupes enrichis via Détail Clients", () => {
  const row = {
    SIREN: "012345678",
    "Raison Sociale": "Client",
    "Direction commerciale": "AURA",
    "Seg Nationale Libellé": "MDM",
  };
  const detail = {
    "ENT. SIREN": "012345678",
    "Raison Sociale": "Client",
    "GRP. Raison Sociale": "Groupe A",
  };
  const data = D.importSheets([
    { name: "DEGSE", headers: Object.keys(row), rows: [row] },
    { name: "Détail Clients", headers: Object.keys(detail), rows: [detail] },
  ]);
  assert.equal(data.clients["012345678"].direction, "AURA");
  assert.equal(data.clients["012345678"].segment, "MDM");
  assert.equal(data.clients["012345678"].groupName, "Groupe A");
});
test("Doublons Excel : aucune somme implicite, diagnostic et marquage", () => {
  const rows = [
    { SIREN: "012345678", "Raison Sociale": "A", "CA GLOBAL 12 mois": 12 },
    { SIREN: "012345678", "Raison Sociale": "B", "CA GLOBAL 12 mois": 13 },
    { SIREN: "invalide", "Raison Sociale": "C" },
  ];
  const data = D.importSheets([
    { name: "DEGSE", headers: Object.keys(rows[0]), rows },
  ]);
  assert.equal(data.duplicates, 1);
  assert.equal(data.invalid, 1);
  assert.equal(data.clients["012345678"].caOrange, 12);
  assert.equal(data.clients["012345678"].duplicate, true);
});
test("Import incompatible rejeté, colonnes requises explicites", () => {
  assert.throws(() => D.importSheets([{ name: "Autre", rows: [] }]), /DEGSE/);
  assert.throws(
    () =>
      D.importSheets([
        { name: "DEGSE", headers: ["Nom"], rows: [{ Nom: "A" }] },
      ]),
    /obligatoires/,
  );
});
test("Couverture Orange inconnue : aucune opportunité automatique ; connue : différence des pays", () => {
  const r = researched();
  assert.equal(D.opportunities(null, r).known, false);
  assert.deepEqual(D.opportunities(null, r).open, []);
  r.coverage = { known: true, countries: ["Chine"], source: "CRM" };
  assert.deepEqual(D.opportunities(null, r).open, ["Italie"]);
  assert.deepEqual(
    D.opportunities({ coverageKnown: true, coverage: ["Italie", "Chine"] }, r)
      .open,
    [],
  );
});
test("Validation : URLs dangereuses, dates futures et régions vagues refusées", () => {
  const r = researched();
  r.sources.presence = "javascript:alert(1)";
  assert.throws(() => D.validateResearch(r), /URL/);
  r.sources.presence = "https://example.com";
  r.checkedAt = "2999-01-01";
  assert.throws(() => D.validateResearch(r), /Date/);
  r.checkedAt = "2026-01-12";
  r.countries = ["Europe"];
  assert.throws(() => D.validateResearch(r), /Pays/);
  assert.equal(D.safeURL("https://user:pass@example.com"), "");
  assert.equal(D.validDate("2026-02-30"), false);
});
test("CSV : formules neutralisées et guillemets échappés", () => {
  assert.equal(D.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(D.csvCell("A;B"), '"A;B"');
  assert.equal(D.csvCell('"test"'), '"""test"""');
});
