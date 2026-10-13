# DEGSE — Développement international

Analyseur local du portefeuille clients Orange DEGSE, centré sur les opportunités transfrontalières. La vue consolidée remplace les anciens onglets de performance générale, risque, croissance, cartes et scores de proximité géographique.

## Utilisation

1. Ouvrir **`analyseurcode.html`** dans un navigateur récent (Chrome, Edge ou Firefox). Le fichier inclut le lecteur Excel, les styles, le code et les recherches historiques ; il fonctionne sans CDN et sans serveur applicatif.
2. Importer un classeur **`.xlsx`** contenant un onglet **DEGSE**, avec **SIREN** et **Raison Sociale**. Les en-têtes peuvent être précédés de lignes de titre, dans les 30 premières lignes. Convertir les anciens `.xls` en `.xlsx` avec Excel.
3. Consulter le diagnostic d’import. Si nécessaire, choisir explicitement les colonnes de direction commerciale AURA/RM et de catégorie MDM/HDM/SPES. Ces informations viennent du classeur ; aucun département ne sert à les déduire.
4. Utiliser les filtres de pays, siège, groupe, secteur, commercial, direction et catégorie. Ouvrir une entreprise pour consulter séparément la ligne Excel et les informations de recherche.
5. Compléter l’analyse avec des sources, une date de consultation, le périmètre de la présence et du CA mondial. Cocher la relecture seulement après avoir vérifié les faits, les preuves et l’identité de l’entreprise.
6. Exporter la vue filtrée en CSV pour le travail commercial et les recherches en JSON pour les conserver ou les partager.

Le portefeuille Excel reste en mémoire pendant la session : il faut le réimporter après un rechargement. Les analyses modifiées et les critères sont conservés dans le stockage local du navigateur, lorsque celui-ci est disponible. Une sauvegarde JSON conserve les données structurées, les recherches historiques et les versions précédentes. L’import JSON conserve les critères locaux et remet les analyses importées en attente de relecture. Il ne modifie pas le fichier Excel. Le CSV exporte toute la vue filtrée, pas uniquement la page visible.

## Qualification

- **Analysé** : une recherche existe, qu’elle corresponde ou non aux critères.
- **Non analysé** : aucune recherche enregistrée.
- **À qualifier** : des preuves, une relecture ou un périmètre restent à préciser.
- **Cible confirmée** : l’analyse relue, les liens de preuve et la date renseignée satisfont les critères configurés. Il s’agit d’une validation par l’analyste ; le programme ne vérifie pas automatiquement le contenu des pages web.
- **Hors critères** : les informations documentées ne satisfont pas les critères actuels. Cela ne démontre pas l’absence générale de potentiel international.

Les pays ciblés par défaut sont **Italie, Suisse, Luxembourg, Belgique et Allemagne**. Tout autre pays hors France est classé **International — Autre** et peut être inclus dans les critères. Un même compte peut apparaître dans plusieurs pays. Les pays doivent être explicitement nommés ; « Europe », « monde » ou « pays à confirmer » restent des mentions incertaines.

Le siège français **n’est pas obligatoire par défaut**, conformément au besoin métier : c’est une information et un filtre distincts. Le siège de l’entité cliente est séparé de celui du groupe. Une présence du groupe peut satisfaire les critères si le lien de l’entité à ce groupe est documenté. Les implantations opérationnelles sont distinguées de la distribution et de l’export.

Le **CA Orange sur 12 mois** vient d’Excel. Le **CA mondial** provient de la recherche et conserve sa devise, son exercice et son périmètre (entreprise ou groupe). Aucun montant historique textuel n’est converti automatiquement. Le seuil facultatif de CA porte uniquement sur des montants structurés et sourcés en EUR ; les autres devises ne sont pas converties.

La couverture Orange vient d’une colonne Excel explicite, ou, à défaut, d’une référence commerciale renseignée dans la fiche. Les pays de présence hors couverture connue sont des **pistes à valider**, pas des contrats ou des opportunités de revenu démontrées. Si la couverture est inconnue, aucun écart n’est inventé.

## Données et périmètre

Les **721 SIREN historiques** sont repris du HTML fourni, avec les deux jeux de recherches et la liste d’anciens classements. Les anciennes mentions « CONFIRMÉ » sont archivées, sans être reconduites comme confirmations actuelles. Les URL anciennes restent disponibles, mais ne sont pas affectées arbitrairement comme preuve de chaque champ. Les recherches historiques **n’ont pas été revalidées sur Internet**.

Les recherches sans correspondance dans le classeur importé restent consultables via les périmètres « Portefeuille + recherches » et « Recherches hors portefeuille ». Les informations commerciales sont affichées comme non renseignées pour ces entreprises.

Les doublons SIREN sont signalés et la première ligne est conservée, sans addition automatique de CA. Les zéros initiaux des SIREN sont préservés. L’onglet facultatif **Détail Clients** complète les informations de groupe ; leur onglet, ligne et colonnes d’origine restent consultables. Les formules Excel ne sont pas recalculées par le navigateur : leurs résultats doivent avoir été enregistrés dans le classeur.

Les en-têtes répétés (par exemple CUID, CUID Cible ou RDV BM.) ne bloquent pas l’import. Chaque occurrence conserve ses valeurs dans une colonne distincte, identifiée par son numéro, et le diagnostic les signale. Pour les informations reconnues automatiquement, la première occurrence est utilisée par défaut ; la direction et la catégorie commerciales peuvent être choisies explicitement dans les correspondances de colonnes.

Aucun fichier ni recherche n’est envoyé à un service externe par l’analyseur. Les liens de preuve s’ouvrent sur demande. Cette version est un outil local : elle ne fournit pas de recherche Google automatique ni de base de données partagée entre plusieurs utilisateurs.

## Sources et validation

Les fichiers maintenables sont `index.template.html`, `assets/core.js` (règles métier), `assets/app.js` (interface/import/export), `assets/styles.css` et `data/recherches-historiques.json`. `analyseurcode.html` est l’artefact autonome à distribuer.

```sh
cd /workspace/CodexAnto
python scripts/build.py
node --test tests/core.test.js
python tests/browser_test.py
```

La construction utilise uniquement Python standard. Les tests métier utilisent Node.js sans dépendance supplémentaire. Les tests de navigateur utilisent Python avec `playwright` et `openpyxl`, et Chromium disponible dans cet environnement. Ils créent un classeur synthétique temporaire, vérifient les parcours et arrêtent leur serveur local à la fin. Les données de test ne sont jamais incluses dans l’application.

Le lecteur ExcelJS **4.4.0** est distribué localement sous licence MIT (`vendor/EXCELJS-LICENSE`). L’archive obtenue depuis `registry.npmjs.org` a été vérifiée avec son intégrité SHA-512 :

```text
XctvKaEMaj1Ii9oDOqbW/6e1gXknSY4g/aLCDicOXqBE4M0nRWkUu0PTp++UPNzoFY12BNHMfs/VadKIS6llvg==
```

Les champs importés sont échappés pour leur affichage HTML. Les liens n’acceptent que HTTP/HTTPS sans identifiants intégrés ; les champs exportés en CSV neutralisent les préfixes de formule. La validation de l’interface a été effectuée sur un **classeur synthétique**, le classeur clients réel n’ayant pas été fourni.
