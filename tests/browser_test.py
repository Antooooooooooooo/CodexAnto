"""Parcours réels dans Chromium, sur un classeur synthétique (aucune donnée client)."""
import functools
import json
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from openpyxl import Workbook
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

def fixture(path):
    wb = Workbook()
    ws = wb.active
    ws.title = 'DEGSE'
    ws.append(['PORTEFEUILLE FICTIF — VALIDATION TECHNIQUE'])
    ws.append(['SIREN', 'Raison Sociale', 'Rattachement commercial', 'Famille client', 'Nom et prénom VRC', 'Macro-sect. Nat. Libellé', 'CA GLOBAL 12 mois', 'Pays accompagnés par Orange'])
    ws.append(['037320595', 'Client historique fictif', 'AURA', 'MDM', 'Commercial A', 'Industrie', 12000, ''])
    ws.append(['123456789', 'Filiale fictive internationale', 'RM', 'SPES', '=FORMULE_FICTIVE', 'Services', 54000, 'Chine'])
    ws.cell(4, 5).data_type = 's'  # Texte potentiellement interprété comme formule lors d’un export CSV.
    ws.append(['987654321', '<img src=x onerror="window.injected=true">', 'AURA', 'HDM', 'Commercial B', 'Commerce', None, ''])
    ws.append(['123456789', 'DOUBLON FICTIF', 'AURA', 'MDM', 'Autre', 'Autre', 999999, ''])
    ws.append(['INVALIDE', 'Ligne invalide', 'RM', 'MDM'])
    for col, header in enumerate(['CUID','CUID','CUID Cible','CUID Cible','RDV BM.','RDV BM.'], start=9):
        ws.cell(2, col, header)
        ws.cell(4, col, f'VALEUR DISTINCTE {col}')
    details = wb.create_sheet('Détail Clients')
    details.append(['ENT. SIREN', 'Raison Sociale', 'GRP. Raison Sociale', 'GRP. SIREN Maison Mère'])
    details.append(['123456789', 'Filiale fictive internationale', 'Groupe mentionné dans Excel', '222222222'])
    details.cell(1, 5, 'CUID')
    details.cell(1, 6, 'CUID')
    details.cell(2, 5, 'DETAIL PREMIER')
    details.cell(2, 6, 'DETAIL SECOND')
    wb.save(path)

def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}/analyseurcode.html'
    checks = []
    try:
        with tempfile.TemporaryDirectory(prefix='degse-test-') as tmp, sync_playwright() as p:
            tmp = Path(tmp)
            xlsx = tmp / 'portefeuille-fictif.xlsx'
            fixture(xlsx)
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            context = browser.new_context(viewport={'width':1440,'height':1000}, accept_downloads=True)
            page = context.new_page()
            errors, external = [], []
            page.on('pageerror', lambda err: errors.append(str(err)))
            page.on('request', lambda req: external.append(req.url) if not req.url.startswith(url.rsplit('/',1)[0]) else None)
            page.goto(url)
            expect(page.locator('#metrics .metric strong').nth(0)).to_have_text('721')
            expect(page.locator('#metrics .metric strong').nth(2)).to_have_text('0')
            checks.append('721 recherches historiques migrées, zéro confirmation héritée')
            page.locator('#search').fill('378317721')
            page.locator('[data-company="378317721"]').click()
            form = page.locator('#researchForm')
            expect(form.locator('[name="countryCount"]')).to_have_value('14 pays européens au niveau groupe')
            expect(form.locator('[name="revenueAmount"]')).to_have_value('6410000000')
            assert 'volume d’affaires France' in form.locator('[name="franceRevenue"]').input_value()
            expect(page.locator('#suppliedDetail')).to_contain_text('lot 16, ligne 474')
            assert page.locator('#suppliedDetail a').count() >= 2
            page.locator('[data-close="companyDialog"]').first.click()
            page.locator('#search').fill('418096392')
            page.locator('[data-company="418096392"]').click()
            expect(page.locator('#researchForm [name="revenueAmount"]')).to_have_value('')
            assert '449,4' in page.locator('#researchForm [name="franceRevenue"]').input_value()
            page.locator('[data-close="companyDialog"]').first.click()
            page.locator('#resetFilters').click()
            page.locator('.advanced').evaluate('(el) => el.open = true')
            page.locator('#followup').select_option('À rechercher par l’utilisateur')
            expect(page.locator('#tableBody')).to_contain_text('761200773')
            page.locator('#resetFilters').click()
            checks.append('Lots utilisateur, nombres de pays/sites, CA France séparé, sources citées et file de recherche manuelle')
            page.locator('#excelInput').set_input_files(str(xlsx))
            expect(page.locator('#fileMeta')).to_contain_text('3 entreprises importées')
            expect(page.locator('#tableBody tr')).to_have_count(3)
            expect(page.locator('#diagnosticContent')).to_contain_text('1 SIREN en doublon')
            expect(page.locator('#diagnosticContent')).to_contain_text('En-têtes répétés dans DEGSE : CUID, CUID Cible, RDV BM.')
            expect(page.locator('#diagnosticContent')).to_contain_text('En-têtes répétés dans Détail Clients')
            checks.append('En-têtes CUID/CUID Cible/RDV BM. répétés acceptés, y compris dans Détail Clients')
            assert page.evaluate('window.injected') is None
            checks.append('Import XLSX réel, en-tête décalé, SIREN avec zéro, doublon, ligne invalide et affichage sécurisé')
            page.locator('#importDiagnostic').evaluate('(el) => el.open = true')
            page.locator('#mapDirection').select_option('Rattachement commercial')
            page.locator('#mapSegment').select_option('Famille client')
            page.locator('#applyMapping').click()
            page.locator('.advanced').evaluate('(el) => el.open = true')
            page.locator('#direction').select_option('RM')
            expect(page.locator('#tableBody tr')).to_have_count(1)
            expect(page.locator('#tableBody')).to_contain_text('SPES')
            page.locator('#segment').select_option('SPES')
            expect(page.locator('#tableBody tr')).to_have_count(1)
            checks.append('Correspondance manuelle des colonnes, AURA/RM et MDM/HDM/SPES filtrables depuis Excel')
            page.locator('[data-company="123456789"]').click()
            expect(page.locator('#excelDetail')).to_contain_text('Groupe mentionné dans Excel')
            expect(page.locator('#rawExcel')).to_contain_text('Détail Clients')
            for col in range(9, 15):
                expect(page.locator('#rawExcel')).to_contain_text(f'VALEUR DISTINCTE {col}')
            expect(page.locator('#rawExcel')).to_contain_text('DETAIL PREMIER')
            expect(page.locator('#rawExcel')).to_contain_text('DETAIL SECOND')
            form = page.locator('#researchForm')
            values = {'checkedAt':'2026-01-12','sector':'Services numériques FICTIFS','sectorSource':'https://example.com/sector','hq':'France','hqSource':'https://example.com/hq','groupName':'Groupe FICTIF','groupHQ':'Finlande','groupSource':'https://example.com/group','countries':'Italie ; Suisse ; Allemagne ; Chine ; Pays-Bas','presenceSource':'https://example.com/locations','revenueAmount':'200000000','revenueYear':'2024','revenueSource':'https://example.com/report','notes':'Données synthétiques pour test uniquement.'}
            for name,value in values.items():
                form.locator(f'[name="{name}"]').fill(value)
            for name,value in {'groupRelation':'Oui','presenceScope':'Groupe','presenceType':'Implantation','revenueCurrency':'EUR','revenueScope':'Groupe'}.items():
                form.locator(f'[name="{name}"]').select_option(value)
            form.locator('[name="reviewed"]').check()
            form.get_by_role('button', name='Enregistrer l’analyse').click()
            expect(page.locator('#companyDialog')).not_to_be_visible()
            expect(page.locator('#tableBody')).to_contain_text('Cible confirmée')
            expect(page.locator('#tableBody')).to_contain_text('Finlande')
            expect(page.locator('#tableBody')).to_contain_text('Pays-Bas')
            expect(page.locator('#tableBody')).to_contain_text('CA de la relation Orange')
            checks.append('Fiche, preuves, siège entité/groupe, CA mondial daté avec périmètre, confirmation selon critères')
            page.locator('#hq').select_option('france')
            page.locator('#group').select_option('foreign')
            expect(page.locator('#tableBody tr')).to_have_count(1)
            page.locator('#gap').select_option('yes')
            expect(page.locator('#tableBody')).to_contain_text('Pistes à valider commercialement')
            checks.append('Filtres siège français et groupe étranger, opportunités calculées avec couverture Orange Excel')
            page.locator('#countryFilters input[value="Luxembourg"]').check()
            expect(page.locator('#tableBody')).to_contain_text('Aucune entreprise')
            page.locator('#countryFilters input[value="Luxembourg"]').uncheck()
            page.locator('#countryFilters input[value="International — Autre"]').check()
            expect(page.locator('#tableBody')).to_contain_text('Filiale fictive internationale')
            page.locator('#resetFilters').click()
            page.locator('#methodBtn').click()
            page.locator('#criteriaForm [name="includeGroups"]').uncheck()
            page.get_by_role('button', name='Appliquer les critères').click()
            expect(page.locator('#metrics .metric strong').nth(2)).to_have_text('0')
            page.locator('#methodBtn').click()
            page.locator('#criteriaForm [name="includeGroups"]').check()
            page.get_by_role('button', name='Appliquer les critères').click()
            expect(page.locator('#metrics .metric strong').nth(2)).to_have_text('1')
            checks.append('Sélection des pays et critères modifiables : recalcul effectif de la qualification')
            with page.expect_download() as d:
                page.locator('#exportBtn').click()
            d.value.save_as(str(tmp/'vue.csv'))
            csv = (tmp/'vue.csv').read_text(encoding='utf-8-sig')
            assert "'=FORMULE_FICTIVE" in csv and '200000000' in csv and '54000' in csv
            with page.expect_download() as d:
                page.locator('#backupBtn').click()
            d.value.save_as(str(tmp/'backup.json'))
            backup = json.loads((tmp/'backup.json').read_text())
            assert backup['researches']['123456789']['reviewed'] is True
            assert sum(len(r.get('contributions', [])) for r in backup['researches'].values()) == 16
            assert backup['researches']['378317721']['countryCount'] == '14 pays européens au niveau groupe'
            checks.append('Export CSV de toute la vue, neutralisation des formules, sauvegarde JSON complète')
            page.reload()
            page.locator('#scope').select_option('research')
            page.locator('#search').fill('123456789')
            expect(page.locator('#tableBody')).to_contain_text('Cible confirmée')
            expect(page.locator('#tableBody')).to_contain_text('Filiale fictive internationale')
            checks.append('Persistance des analyses et critères après rechargement')
            page.locator('#researchInput').set_input_files(str(tmp/'backup.json'))
            expect(page.locator('#notice')).to_contain_text('Les preuves doivent être relues')
            expect(page.locator('#tableBody')).to_contain_text('À qualifier')
            bad = tmp/'bad.json'
            bad.write_text(json.dumps({'schemaVersion':1,'researches':{'123456789':{'siren':'bad'}}}))
            page.locator('#researchInput').set_input_files(str(bad))
            expect(page.locator('#notice')).to_contain_text('Aucune recherche modifiée')
            checks.append('Restauration atomique, historique conservé, import externe soumis à relecture')
            # Le portefeuille Excel ne persiste pas : on le réimporte après rechargement.
            page.locator('#excelInput').set_input_files(str(xlsx))
            expect(page.locator('#fileMeta')).to_contain_text('3 entreprises importées')
            bad_excel = Workbook()
            bad_excel.active.title = 'Autre'
            bad_excel.save(tmp/'bad.xlsx')
            page.locator('#excelInput').set_input_files(str(tmp/'bad.xlsx'))
            expect(page.locator('#notice')).to_contain_text('DEGSE est requis')
            page.locator('#search').fill('')
            page.locator('#scope').select_option('portfolio')
            expect(page.locator('#tableBody tr')).to_have_count(3)
            checks.append('Import incompatible : portefeuille précédent conservé')
            page.locator('#resetFilters').click()
            page.screenshot(path='/tmp/degse-desktop-final.png',full_page=True)
            page.set_viewport_size({'width':390,'height':844})
            page.screenshot(path='/tmp/degse-mobile-final.png',full_page=True)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            checks.append('Présentation desktop/mobile, aucun débordement de la page hors tableau défilant')
            assert errors == [], errors
            assert external == [], external
            checks.append('Aucune erreur JavaScript et aucune requête externe pendant les parcours')
            # Deuxième import : groupes et filtres de l’ancien portefeuille ne doivent pas rester.
            single = Workbook(); ws = single.active; ws.title = 'DEGSE'
            ws.append(['SIREN','Raison Sociale','Direction commerciale','Marché'])
            ws.append(['444444444','NOUVEAU CLIENT FICTIF','RM','HDM'])
            single.save(tmp/'second.xlsx')
            page.locator('#excelInput').set_input_files(str(tmp/'second.xlsx'))
            expect(page.locator('#fileMeta')).to_contain_text('1 entreprises importées')
            expect(page.locator('#tableBody')).to_contain_text('NOUVEAU CLIENT FICTIF')
            page.locator('[data-company="444444444"]').click()
            expect(page.locator('#excelDetail dt').filter(has_text='Groupe mentionné dans Excel').locator('..').locator('dd')).to_have_text('Non renseigné')
            checks.append('Réimport : aucune donnée de groupe du portefeuille précédent conservée')
            browser.close()
        print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False,indent=2))
    finally:
        server.shutdown(); server.server_close()

if __name__ == '__main__':
    main()
