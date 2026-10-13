/* Bilan reproductible des seules données publiques embarquées, sans portefeuille Excel. */
"use strict";
const fs = require("node:fs"), path = require("node:path"), D = require("../assets/core.js");
const root = path.resolve(__dirname, ".."), read = name => JSON.parse(fs.readFileSync(path.join(root, "data", name)));
const verified = read("recherches-verifiees.json");
const records = D.addContributions(D.addContributions(D.fromLegacy(read("recherches-historiques.json")), read("complements-utilisateur.json")), verified);
const registry = verified.records.filter(e => e.kind === "registry"), docs = verified.records.filter(e => e.kind === "documentary");
const scoped = registry.map(e => records[e.siren]);
const report = {
  consultation: "2026-10-13",
  perimetre: "719 SIREN historiques rapprochés du portefeuille fourni ; aucun contenu du classeur publié.",
  sieges_et_activites_verifies: registry.length,
  sieges_france: scoped.filter(r => r.registeredCountry === "France").length,
  sieges_hors_france: scoped.filter(r => r.registeredCountry && r.registeredCountry !== "France").length,
  entites_fermees: scoped.filter(r => r.registryState === "Fermée").length,
  ca_comptes_societe_disponibles: scoped.filter(r => r.registeredRevenue).length,
  fiches_avec_complements_documentaires: docs.length,
  fiches_avec_pays_documentes_par_nouvelle_source: scoped.filter(r => r.documentedCountries?.length).length,
  fiches_avec_ventilation_des_implantations_propres: scoped.filter(r => r.operationalCountries?.length).length,
  ca_mondiaux_dates_dans_les_pieces: docs.filter(e => e.fields.revenue).length,
  ca_mondiaux_dont_source_affectee_au_chiffre_affiche: scoped.filter(r => D.proof(r, "revenue")).length,
  fiches_avec_champs_encore_manquants_ou_a_preciser: scoped.filter(r => D.missingInfo(r).length).length,
  recherches_a_reprendre_par_utilisateur: scoped.filter(r => D.followupStatus(r) === "À rechercher par l’utilisateur").length,
  limites: [
    "Le CA des comptes d'une société n'est ni un CA mondial consolidé de groupe ni un CA France géographiquement isolé.",
    "Les sources explorées restent des pistes tant que leur identité et leur contenu ne sont pas rapprochés : accessibilité ne signifie pas validation factuelle.",
    "Les pays servis, les filiales, les bureaux, les usines et les partenaires sont distingués ; les nombres mondiaux ne deviennent pas des nombres hors France.",
    "Les rapports plus anciens sont conservés dans les pièces sans remplacer un exercice plus récent fourni par l'utilisateur ; la source ancienne n'atteste pas ce chiffre récent.",
    "Une devise non explicitée reste à préciser ; aucune conversion de change ou date d'exercice n'est inventée.",
    "Les champs internationaux ne sont pas tous renseignés. Une information non trouvée ne prouve pas l'absence de présence ou de potentiel international.",
    "Les constats documentaires et les recherches historiques doivent être relus avant confirmation commerciale."
  ]
};
fs.writeFileSync(path.join(root, "data", "bilan-recherches.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
