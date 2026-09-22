/****************************************************
 * Formulaire de contact — holding-normandie.com
 * Hébergement : GitHub Pages (100 % statique, aucun backend)
 * Envoi : Google Apps Script (Web App) + Gmail
 *
 * À faire pour la mise en service :
 *   1. copier ce fichier dans un projet Apps Script
 *   2. régler SEND_TO (adresse du client)
 *   3. déployer en « Application web » (Exécuter en tant que : Moi,
 *      Accès : Tout le monde) puis ouvrir l'URL .../exec
 * Guide pas-à-pas : google-apps-script/DEPLOIEMENT.md
 ****************************************************/

// ── CONFIGURATION ─────────────────────────────────────
// L'adresse de réception N'EST PAS écrite dans ce fichier (sécurité) : elle est
// stockée dans les propriétés du script (Paramètres du projet → Propriétés du script,
// clé « SEND_TO »). Voir DEPLOIEMENT.md étape 3. Sans cette clé, le script refuse
// d'envoyer (statut « send_to_non_config » dans les logs).
const SEND_TO = PropertiesService.getScriptProperties().getProperty('SEND_TO') || '';
const FORM_NAME = 'Formulaire holding-normandie.com';

// ── PARAMÈTRES ANTISPAM ──────────────────────────────
const MIN_DELAY_MS    = 5000;   // délai min entre chargement et soumission
const MAX_LINKS       = 3;      // nb de liens max dans un message
const MAX_PER_HOUR    = 10;     // nb d'envois max / heure (toutes origines)
const MIN_BETWEEN_MS  = 10 * 60e3; // délai min entre 2 envois d'un même e-mail

const SPAM_PATTERNS = [
  /v[i1]agr[ae]/i, /cia?l[ai]s/i, /levitr[ae]/i, /casino/i, /crypt[iy]o?/i,
  /bitcoin/i, /ethereum/i, /forex/i, /\bbinary options\b/i,
  /s[eéè]o pr[iy]ce/i, /backlink/i, /lotter[yie]/i, /\bprize\b/i,
  /free (gift|money|prize|trial|iphone)/i, /click here/i, /^u?rgent$/mi,
  /\bwin(ning|ner| big)?\b/i, /get rich/i, /\bwealth\b/i, /invest now/i,
  /\bbellas\b/i, /\bescort/i, /\bboob(s)?\b/i, /\bviagra online\b/i
];

// ── ENTRÉE (POST depuis le formulaire, encodage urlencoded) ──
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    return traiter(e);
  } catch (err) {
    return repondre(false, 'erreur_interne');
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return HtmlService.createHtmlOutput(
    '<h2>Endpoint prêt.</h2><p>Le formulaire du site envoie ses données en POST vers cette URL.</p>'
  );
}

function traiter(e) {
  const p = (e && e.parameter) || {};
  const f = function (n) { return String(p[n] || '').replace(/^\s+|\s+$/g, ''); };

  const rec = {
    at: new Date().toISOString(),
    status: '', note: '',
    email: f('email'),
    objet: f('objet'), prenom: f('prenom'), nom: f('nom'),
    telephone: f('telephone'), societe: f('societe'), montant: f('montant'),
    message: f('message')
  };
  const honeypot = f('website');
  const tsClient = parseInt(p.ts, 10) || 0;
  const captchaReponse = f('captcha_response');
  const captchaAttendu = f('captcha_expected');

  // 1) Champ piège rempli → bot. Répondre « ok » et n'envoyer rien.
  if (honeypot !== '') return fin(rec, 'faux_honeypot');

  // 1bis) Question de reconnaissance de symbole
  if (!captchaAttendu || captchaReponse !== captchaAttendu
    || captchaReponse.length > 4 || captchaAttendu.length > 4) return fin(rec, 'faux_captcha');

  // 2) Validations de base
  if (!rec.email || !rec.prenom || !rec.nom || !rec.objet) return fin(rec, 'faux_champs_manquants');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rec.email)) return fin(rec, 'faux_email_invalide');
  const tropLong = [rec.prenom, rec.nom, rec.societe, rec.objet].some(function (s) { return s.length > 120; })
    || rec.email.length > 200 || rec.message.length > 5000;
  if (tropLong) return fin(rec, 'faux_trop_long');

  // 3) Soumission trop rapide après chargement de la page ?
  if (!tsClient || Date.now() - tsClient < MIN_DELAY_MS) return fin(rec, 'faux_trop_rapide');

  // 4) Filtre de contenu : liens et mots-clés
  const corpus = (rec.objet + ' ' + rec.societe + ' ' + rec.message).toLowerCase();
  const liens = (corpus.match(/https?:\/\/\S+|www\.[a-z0-9.-]+|\b[a-z0-9-]{2,}\.(com|net|org|info|xyz|top|ru|biz|club|site|online|win|bid|trade|press|party|link)\b/gi) || []).length;
  if (liens > MAX_LINKS) return fin(rec, 'faux_trop_de_liens');
  for (var i = 0; i < SPAM_PATTERNS.length; i++) {
    if (SPAM_PATTERNS[i].test(corpus)) return fin(rec, 'faux_mot_spam');
  }

  // 5) Limitation de débit (globale / heure + refroidissement par e-mail)
  const cache = CacheService.getScriptCache();
  const cleHeure = 'rlh_' + Math.floor(Date.now() / 3600e3);
  const nbHeure = parseInt(cache.get(cleHeure) || '0', 10);
  if (nbHeure >= MAX_PER_HOUR) return fin(rec, 'faux_debit_heure');
  const cleMail = 'rlm_' + Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, rec.email.toLowerCase());
  if (cache.get(cleMail)) return fin(rec, 'faux_debit_email');
  cache.put(cleHeure, String(nbHeure + 1), 7200);
  cache.put(cleMail, '1', Math.ceil(MIN_BETWEEN_MS / 1000));

  // 6) Envoi de l'e-mail
  if (!SEND_TO) return fin(rec, 'send_to_non_config');
  const sujet = '[' + FORM_NAME + '] ' + rec.objet + ' — ' + rec.prenom + ' ' + rec.nom;
  try {
    MailApp.sendEmail({
      to: SEND_TO,
      subject: sujet.slice(0, 120),
      replyTo: rec.email,
      name: FORM_NAME,
      htmlBody: construireHtml(rec)
    });
    return fin(rec, 'envoye');
  } catch (err) {
    rec.note = String(err);
    journaliser(rec);
    return repondre(false, 'erreur_envoi');
  }
}

// ── Sortie : toujours format JSON (lisible par curl, ignoré côté no-cors)
function fin(rec, status) {
  rec.status = status;
  journaliser(rec);
  return repondre(true, status);
}

function repondre(ok, status) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok, status: status }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Journal : Google Sheet auto-créée au premier envoi (dossier Drive du
//    compte qui exécute le script)
function journaliser(rec) {
  try {
    const props = PropertiesService.getScriptProperties();
    let id = props.getProperty('LOG_SPREADSHEET_ID');
    let sp = null;
    if (id) { try { sp = SpreadsheetApp.openById(id); } catch (x) { sp = null; } }
    if (!sp) {
      sp = SpreadsheetApp.create('Logs formulaire — holding-normandie.com');
      const feuille = sp.getSheets()[0];
      feuille.setName('Soumissions');
      const entetes = ['Horodatage', 'Statut', 'E-mail', 'Objet', 'Prénom', 'Nom',
        'Téléphone', 'Société', 'Montant', 'Message', 'Note'];
      feuille.getRange(1, 1, 1, entetes.length).setValues([entetes]).setFontWeight('bold');
      props.setProperty('LOG_SPREADSHEET_ID', sp.getId());
    }
    const w = sp.getSheetByName('Soumissions') || sp.getSheets()[0];
    w.appendRow([rec.at, rec.status, rec.email, rec.objet, rec.prenom, rec.nom,
      rec.telephone, rec.societe, rec.montant, rec.message, rec.note]);
  } catch (err) { /* le log ne doit jamais bloquer l'envoi */ }
}

// ── Mise en forme de l'e-mail
function construireHtml(rec) {
  const ech = function (s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  };
  const aff = function (s) {
    return (s === '' || s === 'Je préfère en discuter') ? '<i>—</i>' : ech(s);
  };
  const portee = ech(rec.objet);
  const cell = function (k, v) {
    return '<tr><td style="padding:9px 14px;border:1px solid #e5dcc8;background:#f7f3eb;font-weight:bold;white-space:nowrap">'
      + k + '</td><td style="padding:9px 14px;border:1px solid #e5dcc8">' + v + '</td></tr>';
  };
  return '<div style="font:15px Arial,Helvetica,sans-serif;color:#172434;max-width:640px">'
    + '<p style="margin:0 0 14px"><strong>' + ech(FORM_NAME) + '</strong><br>Nouvelle demande reçue le ' + ec2(rec.at) + '</p>'
    + '<table style="border-collapse:collapse;width:100%">'
    + cell('Objet', portee)
    + cell('Prénom', aff(rec.prenom)) + cell('Nom', aff(rec.nom))
    + cell('E-mail', ech(rec.email))
    + cell('Téléphone', aff(rec.telephone))
    + cell('Société', aff(rec.societe))
    + cell('Montant', aff(rec.montant))
    + cell('Message', aff(rec.message))
    + '</table>'
    + '<p style="margin:14px 0 0;font-size:12px;color:#697480">Répondez directement depuis Gmail : l\'expéditeur d\'origine est renseigné en réponse.</p>'
    + '</div>';
}

function ec2(iso) {
  // Affiche un horodatage lisible (heure locale du compte)
  try { return String(new Date(iso)); } catch (e) { return iso; }
}