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
function suppliedRecords() {
  const path = require("node:path");
  const legacy = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../data/recherches-historiques.json"),
    ),
  );
  const supplied = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../data/complements-utilisateur.json"),
    ),
  );
  return {
    legacy,
    supplied,
    base: D.addContributions(D.fromLegacy(legacy), supplied),
  };
}
test("Lots 14–16 : seize compléments sans doublons, originaux conservés et aucune date de consultation inventée", () => {
  const { legacy, supplied, base } = suppliedRecords();
  assert.equal(supplied.records.length, 16);
  assert.equal(Object.keys(base).length, 721);
  for (const entry of supplied.records) {
    const r = base[entry.siren];
    assert.equal(r.contributions.length, 1);
    assert.deepEqual(r.contributions[0].originalFields, entry.originalFields);
    assert.deepEqual(
      r.legacy.verification,
      legacy.verification[entry.siren] || {},
    );
    assert.deepEqual(r.legacy.enriched, legacy.enriched[entry.siren] || {});
    assert.equal(r.reviewed, false);
    assert.equal(r.checkedAt, "");
    assert.notEqual(D.qualify(r, criteria).status, "Cible confirmée");
    assert.deepEqual(D.validateResearch(r).contributions, r.contributions);
  }
  assert.deepEqual(base["331211466"].countries, [
    "Italie",
    "États-Unis",
    "Chine",
    "Inde",
  ]);
});
test("CA France et CA mondial distincts ; revenus du groupe, devise et exercice préservés", () => {
  const { base } = suppliedRecords();
  assert.equal(base["418096392"].revenue.amount, null);
  assert.match(base["418096392"].franceRevenue, /449,4/);
  assert.equal(base["378317721"].revenue.amount, 6410000000);
  assert.equal(base["378317721"].revenue.scope, "Groupe");
  assert.match(base["378317721"].franceRevenue, /volume d’affaires France/);
  assert.equal(base["542015516"].revenue.currency, "CHF");
  assert.equal(base["542015516"].groupHQ, "Suisse");
  assert.equal(base["390609253"].revenue.year, "2025");
});
test("Réseaux et périmètres : nombres publiés conservés sans inventer des implantations propres", () => {
  const { base } = suppliedRecords();
  assert.match(base["955803929"].countryCount, /partenaires/);
  assert.match(base["955803929"].foreignSites, /France et Monaco/);
  assert.equal(base["955803929"].presenceType, "Distribution");
  assert.equal(base["391371101"].presenceType, "Inconnue");
  assert.match(base["391371101"].presenceDetails, /consortium/);
  assert.equal(base["333372522"].countries.length, 0);
  assert.equal(
    D.followupStatus(base["761200773"]),
    "À rechercher par l’utilisateur",
  );
});
test("Saisie locale conservée lors d’un nouveau lot ; compléments, champs nouveaux et différences restent visibles", () => {
  const { base } = suppliedRecords(),
    saved = D.emptyResearch("378317721");
  Object.assign(saved, {
    sector: "Secteur saisi par analyste",
    reviewed: true,
  });
  const r = D.reconcileResearch(base["378317721"], saved);
  assert.equal(r.sector, "Secteur saisi par analyste");
  assert.equal(r.contributions.length, 1);
  assert.ok(r.countryCount);
  assert.equal(r.reviewed, false);
  assert.ok(r.changes.some((c) => c.field === "sector"));
  assert.deepEqual(D.reconcileResearch(base["378317721"], r), r);
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
test("En-têtes répétés : clés uniques, aucune valeur écrasée, collisions évitées", () => {
  const values = [
    "SIREN",
    "Raison Sociale",
    "CUID",
    "CUID",
    "CUID [colonne 4]",
    "CUID Cible",
    "CUID Cible",
    "RDV BM.",
    "RDV BM.",
    "__row",
  ];
  const { headers, duplicates } = D.uniqueHeaders(values);
  assert.equal(new Set(headers.map(D.norm)).size, values.length);
  assert.equal(headers[0], "SIREN");
  assert.equal(headers[2], "CUID");
  assert.notEqual(headers[3], headers[4]);
  assert.notEqual(headers[9], "__row");
  assert.deepEqual(duplicates, ["CUID", "CUID Cible", "RDV BM.", "__row"]);
  const row = Object.fromEntries(
    headers.map((header, i) => [
      header,
      i === 0 ? "012345678" : i === 1 ? "Client" : `valeur ${i}`,
    ]),
  );
  const result = D.importSheets([
    {
      name: "DEGSE",
      headers,
      rows: [row],
      headerIssues: ["En-têtes répétés : import accepté."],
    },
  ]);
  assert.equal(result.clients["012345678"].raw[headers[3]], "valeur 3");
  assert.equal(result.clients["012345678"].raw[headers[4]], "valeur 4");
  assert.ok(result.issues.includes("En-têtes répétés : import accepté."));
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

function verifiedRecords() {
  const {base: previous, legacy, supplied} = suppliedRecords();
  const verified = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../data/recherches-verifiees.json')));
  return {base: D.addContributions(previous, verified), previous, verified, legacy, supplied};
}
test('Registre : 719 SIREN exacts, cinq sièges étrangers, six fermetures, données Excel absentes des constats', () => {
  const {base, verified, legacy} = verifiedRecords();
  const entries = verified.records.filter(e => e.kind === 'registry');
  assert.equal(entries.length, 719);
  assert.equal(new Set(entries.map(e => e.siren)).size, 719);
  assert.equal(entries.filter(e => e.fields.registeredCountry !== 'France').length, 5);
  assert.equal(entries.filter(e => e.fields.registryState === 'Fermée').length, 6);
  for (const e of entries) {
    assert.match(e.fieldSources.hq, new RegExp('q=' + e.siren + '$'));
    const r = base[e.siren];
    assert.ok(r.registryActivity && r.registryNAF);
    assert.equal(r.hq, e.fields.registeredCountry);
    assert.equal(r.reviewed, false);
    assert.equal(D.proof(r, 'hq'), true);
    if (!D.documentaryProof(r, 'presence')) assert.equal(D.qualify(r, criteria).status, 'À qualifier');
    assert.deepEqual(r.legacy.verification, legacy.verification[e.siren] || {});
    D.validateResearch(r);
  }
});
test('Comptes sociaux : 588 CA avec exercice distincts du CA mondial, aucune attribution au groupe', () => {
  const {base} = verifiedRecords();
  assert.equal(Object.values(base).filter(r => r.registeredRevenue).length, 588);
  for (const r of Object.values(base).filter(r => r.registeredRevenue)) {
    assert.match(r.registeredRevenue, /EUR — \d{4} — comptes publiés pour la société SIREN/);
    assert.match(r.registeredRevenue, /géographie non isolée, hors consolidation/);
  }
  assert.notEqual(base['490673423'].revenue.amount, 74370462);
  assert.notEqual(base['399339431'].revenue.amount, 134434851);
});
test('Nouvelles recherches : pays historiques et 16 lots conservés, sources limitées aux nouveaux constats', () => {
  const {base, previous, supplied} = verifiedRecords();
  assert.deepEqual(base['037320595'].countries, previous['037320595'].countries);
  for (const e of supplied.records)
    assert.deepEqual(base[e.siren].contributions.find(x => x.id === e.id), e);
  for (const p of previous['331211466'].countries) assert.ok(base['331211466'].countries.includes(p));
  assert.deepEqual(base['331211466'].operationalCountries, ['États-Unis']);
  assert.equal(base['955803929'].sources.presence, '');
  assert.equal(base['387715360'].sources.presence, '');
  assert.deepEqual(base['387715360'].documentedCountries, []);
  assert.deepEqual(D.opportunities({coverageKnown:true, coverage:[]}, base['387715360']).open, []);
});
test('Ventilation : un distributeur italien ne confirme pas une implantation italienne ; pays historiques non corroborés exclus', () => {
  const {base} = verifiedRecords();
  const r = base['331211466'];
  r.reviewed = true;
  assert.notEqual(D.qualify(r, {...criteria, targets:['Italie']}).status, 'Cible confirmée');
  assert.equal(D.qualify(r, {...criteria, targets:[D.OTHER]}).status, 'Cible confirmée');
  r.documentedCountries = ['Italie','États-Unis'];
  assert.notEqual(D.qualify(r, {...criteria, targets:['Italie']}).status, 'Cible confirmée');
  assert.equal(D.qualify(r, {...criteria, targets:['Italie'], operationalOnly:false}).status, 'Cible confirmée');
  assert.throws(() => D.validateResearch({...r, operationalCountries:['Japon'], countries:['Italie']}), /ventilation/);
});
test('Partenaires indépendants et entités fermées ne deviennent pas des cibles opérationnelles', () => {
  const {base} = verifiedRecords();
  const network = base['349423301'];
  network.reviewed = true;
  assert.notEqual(D.qualify(network, criteria).status, 'Cible confirmée');
  assert.equal(D.qualify(network, {...criteria, operationalOnly:false}).status, 'Cible confirmée');
  const closed = researched(); closed.registryState = 'Fermée';
  assert.notEqual(D.qualify(closed, criteria).status, 'Cible confirmée');
});
test('Rapport antérieur : FY2025 conservé, CA vérifié FY2024 archivé sans réattribuer la source récente', () => {
  const {base, previous} = verifiedRecords();
  assert.deepEqual(base['305823296'].revenue, previous['305823296'].revenue);
  assert.equal(base['305823296'].sources.revenue, '');
  const oldReport = base['305823296'].contributions.find(e => e.kind === 'documentary');
  assert.equal(oldReport.fields.revenue.amount, 2541900000);
  assert.equal(oldReport.fields.revenue.year, '2024');
  assert.equal(base['378317721'].revenue.amount, 6405874000);
  assert.equal(base['399384890'].revenue.amount, 37000000);
  assert.equal(base['399918531'].revenue.currency, 'Autre');
  assert.equal(base['592052302'].revenue.amount, 11245200000);
});
test('Dates par champ : une consultation du registre ne revalide pas les autres preuves', () => {
  const r = researched();
  r.checkedAt = '2026-10-13';
  r.sourceDates = {presence:'', hq:'2026-10-13'};
  r.sources.hq = 'https://example.com/registry';
  assert.equal(D.proof(r,'presence'), false);
  assert.equal(D.proof(r,'hq'), true);
  assert.notEqual(D.qualify(r, criteria).status, 'Cible confirmée');
  assert.deepEqual(D.validateResearch(r).sourceDates, r.sourceDates);
});
test('Migration des saisies : nouveaux registres et pièces conservés sans écraser le siège saisi localement', () => {
  const {base, previous} = verifiedRecords();
  const saved = structuredClone(previous['378317721']);
  saved.hq = 'Suisse'; saved.reviewed = true;
  saved.sources.hq = 'https://example.com/other-source';
  const migrated = D.reconcileResearch(base['378317721'], saved);
  assert.equal(migrated.hq, 'Suisse');
  assert.equal(migrated.registeredCountry, 'France');
  assert.equal(migrated.sources.hq, saved.sources.hq);
  assert.equal(migrated.reviewed, false);
  assert.equal(migrated.contributions.filter(e=>e.kind === 'registry').length, 1);
  D.validateResearch(migrated);
  assert.deepEqual(D.reconcileResearch(base['378317721'], migrated), migrated);
});


test('Ciblage documentaire : onze cibles réelles sans relecture forcée, pays opérationnels exacts', () => {
  const {base} = verifiedRecords();
  const qualified = Object.values(base).filter(r => D.qualify(r, criteria).status === 'Cible confirmée');
  assert.equal(qualified.length, 11);
  for (const r of qualified) {
    assert.equal(r.reviewed, false);
    assert.equal(D.qualify(r, criteria).basis, 'Recherche documentaire');
    assert.equal(r.registryState, 'Active');
  }
  assert.deepEqual(D.qualify(base['592052302'], criteria).matched, D.BORDER);
  const erowa = D.qualify(base['342484748'], criteria);
  assert.ok(!erowa.matched.includes('Belgique') && !erowa.matched.includes('Luxembourg'));
  assert.notEqual(D.qualify(base['342484748'], {...criteria,targets:['Luxembourg']}).status,'Cible confirmée');
});
test('Un simple lien ajouté ou une pièce falsifiée ne confirme pas automatiquement une cible', () => {
  const r=researched();r.reviewed=false;
  r.contributions=[{id:'piece-importee-fausse',kind:'documentary',fields:{countriesText:'Italie'}}];
  assert.equal(D.documentaryProof(r,'presence'),false);
  assert.notEqual(D.qualify(r,criteria).status,'Cible confirmée');
  const {base}=verifiedRecords(), changed=structuredClone(base['592052302']);
  changed.operationalCountries=['Italie'];
  assert.equal(D.documentaryProof(changed,'presence'),false);
  assert.notEqual(D.qualify(changed,criteria).status,'Cible confirmée');
});
test('Le CA inconnu ne bloque pas la prospection sans seuil ; siège étranger reste un critère facultatif', () => {
  const {base}=verifiedRecords(),r=base['307378489'];
  r.revenue={amount:null,currency:'EUR',year:'',scope:'Inconnu',reported:''};
  assert.equal(D.qualify(r,criteria).status,'Cible confirmée');
  assert.notEqual(D.qualify(r,{...criteria,minRevenue:1}).status,'Cible confirmée');
  assert.equal(D.qualify(base['592052302'],{...criteria,hq:'foreign'}).status,'Hors critères');
  assert.equal(D.qualify(base['592052302'],{...criteria,hq:'France'}).status,'Cible confirmée');
});
test('Présence mixte : une ventilation inconnue ne prouve pas des implantations dans tous les pays', () => {
  const r=researched();r.presenceType='Mixte';r.operationalCountries=null;
  assert.notEqual(D.qualify(r,criteria).status,'Cible confirmée');
  assert.equal(D.qualify(r,{...criteria,operationalOnly:false}).status,'Cible confirmée');
});
test('Suivi commercial séparé des faits, sauvegardes antérieures compatibles et dates futures admises', () => {
  const {base}=verifiedRecords(),r=base['592052302'];
  const updated=D.validateResearch({...r,selected:true,commercialStatus:'Contacté',nextActionDate:'2026-11-15',commercialNotes:'Note interne'});
  assert.equal(updated.selected,true);assert.equal(updated.commercialStatus,'Contacté');
  assert.equal(D.qualify(updated,criteria).status,'Cible confirmée');
  assert.equal(D.validateResearch({...r,commercialStatus:undefined,selected:undefined}).commercialStatus,'Non planifié');
  assert.throws(()=>D.validateResearch({...r,commercialStatus:'Valeur inconnue'}),/Suivi commercial/);
  assert.throws(()=>D.validateResearch({...r,nextActionDate:'2026-02-30'}),/prochaine action/);
});

test('Matrice pays : une couverture inconnue ne devient pas une absence et les anciennes mentions restent à corroborer', () => {
  const r=researched();r.countries=['Italie','Chine','Belgique'];r.documentedCountries=['Italie','Chine'];r.operationalCountries=['Italie','Chine'];
  const matrix=D.coverageMatrix(null,r,criteria);
  assert.equal(matrix.find(x=>x.country==='Italie').coverage,'Inconnue');
  assert.equal(matrix.find(x=>x.country==='Italie').action,'Valider la couverture Orange');
  assert.equal(matrix.find(x=>x.country==='Belgique').presence,'Présence à corroborer');
  assert.equal(matrix.find(x=>x.country==='Allemagne').presence,'Présence non établie');
  assert.equal(matrix.find(x=>x.country==='Chine').targeted,false);
  const covered=D.coverageMatrix({coverageKnown:true,coverage:['Italie','Chine']},r,criteria);
  assert.equal(covered.find(x=>x.country==='Italie').action,'Pas d’écart déclaré');
  assert.equal(D.coverageMatrix(null,r,{...criteria,targets:[D.OTHER]}).find(x=>x.country==='Chine').targeted,true);
});
test('Matrice : distribution, filiales et pays connus seulement dans la couverture restent distincts', () => {
  const r=researched();r.presenceType='Mixte';r.countries=['Italie','Belgique'];r.documentedCountries=['Italie','Belgique'];r.operationalCountries=['Italie'];
  const matrix=D.coverageMatrix({coverageKnown:true,coverage:['Chine']},r,criteria);
  assert.equal(matrix.find(x=>x.country==='Italie').action,'Piste d’extension à valider');
  assert.equal(matrix.find(x=>x.country==='Belgique').eligible,false);
  assert.equal(matrix.find(x=>x.country==='Belgique').presence,'Présence documentée · Mixte');
  assert.equal(matrix.find(x=>x.country==='Chine').presence,'Présence non établie');
  assert.equal(matrix.find(x=>x.country==='Chine').coverage,'Couvert (déclaré)');
});
test('Priorité : la présence ciblée et la couverture connue guident la préparation sans fabriquer de score ou de contrat', () => {
  const r=researched(),today='2026-10-14';
  assert.equal(D.contactPriority(null,r,criteria,today).label,'Couverture à valider');
  const c={coverageKnown:true,coverage:['Chine']};
  const priority=D.contactPriority(c,r,criteria,today);
  assert.equal(priority.label,'Contact à préparer');assert.deepEqual(priority.openTargets,['Italie']);
  assert.match(priority.reasons[0],/Besoin et contrat à vérifier/);
  assert.equal(D.contactPriority({...c,coverage:['Italie']},r,criteria,today).label,'Pas d’écart ciblé');
  r.coverage={known:true,countries:['Italie'],source:'CRM'};
  assert.equal(D.contactPriority(c,r,criteria,today).label,'Contact à préparer'); // Excel prioritaire.
  r.nextActionDate='2026-10-13';assert.ok(D.contactPriority(c,r,criteria,today).rank<priority.rank);
  r.commercialStatus='À écarter';assert.equal(D.contactPriority(c,r,criteria,today).label,'Compte écarté');
  r.registryState='Fermée';assert.equal(D.contactPriority(c,r,criteria,today).label,'Entité fermée');
});
test('Actualité : chaque champ conserve sa propre date ; source absente, date future et exercice ancien sont signalés', () => {
  const r=researched();r.checkedAt='2026-10-13';r.sourceDates.presence='2024-01-01';
  r.revenue={amount:100,currency:'EUR',year:'2023',scope:'Entreprise',reported:''};r.sources.revenue='https://example.com/report';
  let health=D.sourceHealth(r,'2026-10-14');
  assert.equal(health.find(x=>x.field==='presence').state,'stale');
  assert.equal(health.find(x=>x.field==='revenue').state,'stale');
  assert.match(health.find(x=>x.field==='revenue').reason,/Exercice/);
  assert.equal(health.find(x=>x.field==='hq').state,'missing');
  r.sourceDates.presence='';assert.equal(D.sourceHealth(r,'2026-10-14').find(x=>x.field==='presence').state,'undated');
  r.sourceDates.presence='2026-10-15';assert.equal(D.sourceHealth(r,'2026-10-14').find(x=>x.field==='presence').state,'undated');
  r.sourceDates.presence='2025-10-14';assert.equal(D.sourceHealth(r,'2026-10-14').find(x=>x.field==='presence').state,'current');
});
test('Priorité : une preuve ancienne appelle une actualisation sans déqualifier automatiquement la cible ni bloquer sur un CA facultatif', () => {
  const r=researched();r.checkedAt='2024-01-01';
  assert.equal(D.qualify(r,criteria).status,'Cible confirmée');
  assert.equal(D.contactPriority(null,r,criteria,'2026-10-14').label,'Informations à actualiser');
  r.checkedAt='2026-10-13';
  assert.equal(D.sourceHealth(r,'2026-10-14').find(x=>x.field==='revenue').state,'missing');
  assert.equal(D.contactPriority(null,r,criteria,'2026-10-14').label,'Couverture à valider');
  r.reviewed=false;assert.equal(D.contactPriority(null,r,criteria,'2026-10-14').label,'Dossier à compléter');
  assert.deepEqual(D.contactPriority({coverageKnown:true,coverage:['Chine']},r,criteria,'2026-10-14').openTargets,[]);
  r.reviewed=true;r.countries=['Chine'];assert.equal(D.contactPriority(null,r,criteria,'2026-10-14').label,'Hors ciblage');
});
