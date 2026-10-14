# DEGSE — Développement international

Analyseur local du portefeuille clients Orange DEGSE, centré sur les opportunités transfrontalières. La vue consolidée remplace les anciens onglets de performance générale, risque, croissance, cartes et scores de proximité géographique.

## Utilisation

1. Ouvrir **`analyseurcode.html`** dans un navigateur récent (Chrome, Edge ou Firefox). Le fichier inclut le lecteur Excel, les styles, le code et les recherches historiques ; il fonctionne sans CDN et sans serveur applicatif.
2. Importer un classeur **`.xlsx`** contenant un onglet **DEGSE**, avec **SIREN** et **Raison Sociale**. Les en-têtes peuvent être précédés de lignes de titre, dans les 30 premières lignes. Convertir les anciens `.xls` en `.xlsx` avec Excel.
3. Consulter le diagnostic d’import. Si nécessaire, choisir explicitement les colonnes de direction commerciale AURA/RM et de catégorie MDM/HDM/SPES. Ces informations viennent du classeur ; aucun département ne sert à les déduire.
4. Choisir les **pays à prospecter** dans l’unique espace de ciblage. Les cinq pays frontaliers sont actifs par défaut ; **International — Autre** peut être ajouté.
5. Consulter **Cibles confirmées**, **À qualifier**, **Ma sélection** ou **Relances à faire**. Les indicateurs sont cliquables. Après import, le périmètre commence par les comptes déjà étudiés ; le portefeuille complet reste accessible.
6. Ouvrir une fiche : **Synthèse & sources** sépare les données du fichier Excel et les recherches ; **Suivi commercial** enregistre sélection, avancement, prochaine action et notes ; **Corriger l’analyse** permet d’actualiser les faits et leurs preuves.
7. Utiliser **Préparer le contact** pour lire/copier une synthèse avec les pays ciblés, les sources et la couverture Orange connue ou à valider. Le programme ne contacte aucun client.
8. Sélectionner les comptes individuellement ou toute la vue, puis exporter **Ma sélection** en CSV. Utiliser **Sauvegardes** pour exporter/importer le travail complet en JSON.

Le portefeuille Excel reste en mémoire pendant la session : il faut le réimporter après un rechargement. Les analyses modifiées et les critères sont conservés dans le stockage local du navigateur, lorsque celui-ci est disponible. Les navigateurs récents compressent cette sauvegarde pour éviter la saturation liée aux nombreuses sources ; les anciens enregistrements JSON restent compatibles. Les exports JSON restent lisibles et complets. Une sauvegarde JSON conserve les données structurées, les recherches historiques et les versions précédentes. L’import JSON conserve les critères locaux et remet les analyses importées en attente de relecture. Il conserve aussi la sélection et le suivi des comptes non encore analysés. Il ne modifie pas le fichier Excel. Le CSV exporte toute la vue filtrée, pas uniquement la page visible.

## Qualification documentaire et suivi commercial

- **Cible confirmée** : les faits répondent au ciblage, avec une présence prouvée par une **pièce documentaire embarquée vérifiée**, ou par une **saisie relue par l’analyste**. Le lien au groupe doit aussi être documenté si la présence relève du groupe. Les pièces embarquées ne nécessitent plus de cocher une relecture manuelle pour chaque entreprise.
- **À qualifier** : une preuve, une ventilation des pays, le lien au groupe ou un critère actif reste à préciser. Ce statut ne signifie pas qu’aucun contact commercial n’est pertinent.
- **Hors critères** : les faits documentés ne correspondent pas au ciblage courant. Cela ne prouve pas l’absence générale de potentiel.
- **Non analysé** : aucune recherche enregistrée ; le compte peut néanmoins être sélectionné et faire l’objet d’un suivi commercial.

Avec les données embarquées et les **critères par défaut**, **11 cibles documentaires** ressortent, dont KONE, Bechtle, Arkopharma, Hanover et SCAIME. Le registre seul et les anciennes mentions « CONFIRMÉ » ne suffisent pas. Une URL ajoutée ne suffit pas non plus : la qualification automatique compare les faits et les sources avec les pièces embarquées ; toute modification de ces faits demande une nouvelle validation.

**La qualification documentaire est distincte de la validation commerciale.** Une présence ciblée est un motif pour préparer la prospection ; le besoin client, les interlocuteurs et les pays déjà couverts par Orange restent à vérifier. Aucun contrat, intérêt client ou revenu potentiel n’est déduit du seul statut.

Les pays ciblés par défaut sont **Italie, Suisse, Luxembourg, Belgique et Allemagne**. Tout autre pays hors France est classé **International — Autre** et peut être inclus dans les critères. Un même compte peut apparaître dans plusieurs pays. Les pays doivent être explicitement nommés ; « Europe », « monde » ou « pays à confirmer » restent des mentions incertaines.

Le siège français **n’est pas obligatoire par défaut**, conformément au besoin métier : c’est une information et un filtre distincts. Le siège de l’entité cliente est séparé de celui du groupe. Une présence du groupe peut satisfaire les critères si le lien de l’entité à ce groupe est documenté. Les implantations opérationnelles sont distinguées de la distribution et de l’export. Pour une présence mixte, les pays avec implantation propre doivent être précisés ; un distributeur belge n’est pas traité comme une filiale belge. Les pays retenus dans la qualification correspondent à la nature de présence acceptée.

Le **CA Orange sur 12 mois** vient d’Excel. Le **CA mondial** provient de la recherche et conserve sa devise, son exercice et son périmètre (entreprise ou groupe). Aucun montant historique textuel n’est converti automatiquement. Le seuil facultatif de CA porte uniquement sur des montants structurés et sourcés en EUR ; les autres devises ne sont pas converties. **Aucun seuil n’est activé par défaut** : un CA manquant ne bloque donc pas une présence ciblée documentée.

La couverture Orange vient d’une colonne Excel explicite, ou, à défaut, d’une référence commerciale renseignée dans la fiche. Les pays de présence hors couverture connue sont des **pistes à valider**, pas des contrats ou des opportunités de revenu démontrées. Si la couverture est inconnue, aucun écart n’est inventé.

## Données et périmètre

Les **721 SIREN historiques** sont repris du HTML fourni, avec les deux jeux de recherches et la liste d’anciens classements. Les anciennes mentions « CONFIRMÉ » sont archivées, sans être reconduites comme confirmations actuelles. Les URL anciennes restent disponibles, mais ne sont pas affectées arbitrairement comme preuve de chaque champ. Les archives restent inchangées. Les nouvelles vérifications Internet sont conservées séparément et ne revalident pas automatiquement tous les anciens champs.

Les recherches embarquées restent consultables via « Comptes disponibles hors import ». Le périmètre « Portefeuille déjà étudié » ne conserve que celles correspondant au classeur importé. Le périmètre « Portefeuille complet » affiche aussi les comptes non analysés. Les données commerciales ne sont jamais déduites des recherches Internet.

Les **lots utilisateur 14, 15 et 16** ajoutent **16 compléments** (6, 6 et 4 fiches) à des entreprises déjà présentes. Ils sont conservés séparément dans `data/complements-utilisateur.json`, avec les champs d’origine, les liens cités et le numéro de lot. La date de réception ne remplace pas une date de consultation des sources. À elles seules, ces contributions sans date de consultation ne déclenchent aucune confirmation automatique ; les valeurs antérieures restent dans l’archive et les différences sont consultables dans la fiche. Les saisies locales existantes sont conservées lors de l’arrivée d’un nouveau lot.

Les fiches affichent désormais le nombre de pays et son périmètre, les sites / filiales à l’étranger, les précisions sur la présence, les effectifs mondiaux et le CA France publié. Les réseaux de partenaires, les pays commerciaux, les consortiums et les implantations propres restent distincts. Le CA France de Micromania et le volume d’affaires Bechtle France ne sont pas traités comme des CA mondiaux consolidés.

La présentation suit les couleurs **noir, blanc et orange #FF7900**. Le logo Orange est inclus localement (source : [Wikimedia Commons, Orange_logo.svg](https://commons.wikimedia.org/wiki/File:Orange_logo.svg)) ; il n’entraîne aucune requête Internet. Les critères auparavant placés dans une fenêtre séparée sont intégrés au ciblage. Les doublons de filtres « analyse », « qualification », « pays » et « seuil de CA » ont été supprimés. Les détails du registre, les sources et les archives restent accessibles dans les fiches, sans encombrer le tableau.

Le **thème sombre** est proposé par défaut, avec des panneaux gris foncé et des contrastes distincts pour Excel, les recherches et la prospection. Le bouton du bandeau permet de revenir au **thème clair** ; ce choix est conservé dans ce navigateur, indépendamment des analyses et des critères. Les titres, boutons et chiffres clés utilisent **Helvetica 75 Bold** lorsqu’elle est installée (y compris ses appellations Helvetica Neue LT Std / LT Pro 75 Bold). Le fichier de police n’est pas fourni : à défaut, Helvetica Neue, Helvetica ou Arial sert de remplacement. Les textes détaillés restent en graisse normale pour la lisibilité. Aucun chargement de police externe n’est nécessaire.

Le suivi commercial comprend **Non planifié**, **À contacter**, **Contacté**, **Rendez-vous prévu** et **À écarter**. Les prochaines actions échues apparaissent dans « Relances à faire » ; les comptes écartés n’y sont pas relancés. Les dates d’action et les exports de prospection utilisent le jour courant de Paris. Le stockage reste local et les échanges commerciaux effectifs sont à réaliser dans les outils habituels de l’équipe.

### Vérifications du 13 octobre 2026

`data/recherches-verifiees.json` ajoute les constats suivants sur les **719 SIREN historiques présents dans le classeur fourni** :

- **719 identités, sièges déclarés et activités NAF vérifiés**, par rapprochement exact du SIREN dans l’API publique Recherche d’entreprises. Libellés NAF rév. 2 issus de l’INSEE, nomenclature en vigueur en 2026.
- **714 sièges en France, 5 hors France** (Monaco, Pays-Bas, Luxembourg) et **6 entités fermées**. Les entités fermées sont filtrables et nécessitent une vérification du compte actif successeur ; elles ne sont pas confirmées automatiquement.
- **588 CA des comptes de société** avec leur exercice, affichés séparément du CA mondial. Ces montants ne deviennent pas des revenus consolidés de groupe ni des CA France géographiquement isolés.
- **59 fiches avec compléments documentaires** : sites corporate, mentions légales, brochures ou rapports financiers. **34 fiches** ont une liste de pays corroborée par une nouvelle source ; **32** ont une ventilation des pays avec implantation propre. Ces listes peuvent être partielles ou historiques et leurs limites sont explicites.
- **13 CA mondiaux datés dans les pièces**, dont **10 affectés au chiffre actuellement affiché**. Un rapport plus ancien reste dans les pièces sans remplacer un exercice plus récent fourni. Les chiffres sans année et les devises non explicitées restent signalés à préciser.

**Les sept informations demandées ne sont pas toutes établies pour toutes les entreprises.** Le bilan reproductible `data/bilan-recherches.json` dénombre les champs encore manquants ou à préciser. Le secteur déclaré au registre est distingué de la description détaillée issue d’une recherche corporate. Une absence de résultat n’est pas une absence de potentiel.

Les références explorées sont accessibles dans un volet séparé : une page accessible ou un résultat de moteur reste une piste tant que son rattachement au client et ses faits ne sont pas vérifiés. Seuls les liens cités pour un constat alimentent ses preuves. Chaque champ de preuve conserve sa date ; une consultation du registre ne revalide pas une ancienne présence mondiale.

Les pays historiques et les lots utilisateur sont conservés. Les nouveaux pays corroborés et les pays avec implantation propre sont éditables dans la fiche. Quand cette ventilation est connue, la qualification et les pistes de couverture utilisent les pays corroborés ; les critères opérationnels exigent un pays cible avec implantation propre. Un réseau de partenaires indépendants reste distinct. Les sources homonymes de QUADRA/ARCAD et MATHEZ/chocolatier sont signalées et écartées des preuves actuelles.

Les doublons SIREN sont signalés et la première ligne est conservée, sans addition automatique de CA. Les zéros initiaux des SIREN sont préservés. L’onglet facultatif **Détail Clients** complète les informations de groupe ; leur onglet, ligne et colonnes d’origine restent consultables. Les formules Excel ne sont pas recalculées par le navigateur : leurs résultats doivent avoir été enregistrés dans le classeur.

Les en-têtes répétés (par exemple CUID, CUID Cible ou RDV BM.) ne bloquent pas l’import. Chaque occurrence conserve ses valeurs dans une colonne distincte, identifiée par son numéro, et le diagnostic les signale. Pour les informations reconnues automatiquement, la première occurrence est utilisée par défaut ; la direction et la catégorie commerciales peuvent être choisies explicitement dans les correspondances de colonnes.

Aucun fichier ni recherche n’est envoyé à un service externe par l’analyseur. Les liens de preuve s’ouvrent sur demande. Cette version est un outil local : elle ne fournit pas de recherche Google automatique ni de base de données partagée entre plusieurs utilisateurs.

## Sources et validation

Les fichiers maintenables sont `index.template.html`, `assets/core.js` (règles métier), `assets/app.js` (interface/import/export), `assets/styles.css` et `data/recherches-historiques.json`, `data/complements-utilisateur.json` et `data/recherches-verifiees.json`. `analyseurcode.html` est l’artefact autonome à distribuer.

```sh
cd /workspace/CodexAnto
python scripts/build.py
node scripts/report_research.js
node --test tests/core.test.js
python tests/browser_test.py
```

La construction utilise uniquement Python standard. Les tests métier utilisent Node.js sans dépendance supplémentaire. Les tests de navigateur utilisent Python avec `playwright` et `openpyxl`, et Chromium disponible dans cet environnement. Ils créent un classeur synthétique temporaire, vérifient les parcours et arrêtent leur serveur local à la fin. Les données de test ne sont jamais incluses dans l’application.

Le lecteur ExcelJS **4.4.0** est distribué localement sous licence MIT (`vendor/EXCELJS-LICENSE`). L’archive obtenue depuis `registry.npmjs.org` a été vérifiée avec son intégrité SHA-512 :

```text
XctvKaEMaj1Ii9oDOqbW/6e1gXknSY4g/aLCDicOXqBE4M0nRWkUu0PTp++UPNzoFY12BNHMfs/VadKIS6llvg==
```

Les champs importés sont échappés pour leur affichage HTML. Les liens n’acceptent que HTTP/HTTPS sans identifiants intégrés ; les champs exportés en CSV neutralisent les préfixes de formule. La validation de l’interface utilise un **classeur synthétique** dans la suite reproductible. L’import a également été vérifié avec le classeur client réel fourni dans la conversation : les entreprises déjà analysées et les 16 compléments sont retrouvés. Ce classeur réel n’est pas inclus dans le dépôt.
