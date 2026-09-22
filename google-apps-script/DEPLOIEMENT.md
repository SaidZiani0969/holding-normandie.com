# Mise en service du formulaire de contact (Google Apps Script)

Le site est hébergé sur **GitHub Pages** (100 % statique : aucun serveur ne reçoit les
formulaires). Pour que les demandes du site web arrivent réellement dans la boîte e-mail,
on passe par un **Google Apps Script** : un petit programme gratuit, adossé à un compte
Gmail, qui reçoit les données du formulaire et les envoie par e-mail.

> Durée estimée : **10 minutes**. Aucune ligne de code à écrire — il suffit de copier-coller
> le fichier `Code.gs` fourni, de régler **une seule adresse**, puis de cliquer sur « Déployer ».

---

## Prérequis

- Un **compte Google** (Gmail ou Google Workspace) — de préférence **celui du client**,
  car c'est lui qui reçoit les demandes et reste propriétaire du script.
- Un navigateur de bureau (Chrome ou Firefox recommandé).
- Le fichier `google-apps-script/Code.gs` (déjà présent dans ce dossier).

---

## Étape 1 — Créer le projet Apps Script

1. Ouvrez <https://script.google.com> et connectez-vous avec le compte Google choisi.
2. Cliquez sur **« Nouveau projet »** (bouton bleu en haut à droite).
3. Le projet s'ouvre sur un fichier **Code.gs** vide. Renommez le projet : en haut à
   gauche, cliquez sur **« Projet sans titre »**, saisissez
   `Formulaire site holding-normandie` et validez.

## Étape 2 — Copier le code du formulaire

1. Ouvrez le fichier `google-apps-script/Code.gs` de ce dossier (avec le Bloc-notes,
   VS Code… ) et **copiez tout son contenu**.
2. Collez-le dans l'éditeur ouvert à l'étape 1 (**remplacez** le contenu existant).
3. Cliquez sur l'icône **« Enregistrer »** (💾) ou le raccourci `Ctrl + S`.

> 🔑 **Sécurité** : l'adresse de réception **n'est volontairement pas écrite dans le code**.
> Elle est stockée séparément dans les paramètres du projet (étape 3 suivante). Le code
> actuel ne contient donc aucune adresse e-mail.

## Étape 3 — Renseigner l'adresse de réception (paramètres du projet)

L'adresse qui recevra les demandes du site est stockée dans les **« Propriétés du script »** :

1. Dans le projet, ouvrez la colonne de gauche, puis cliquez sur l'icône
   **⚙️ « Paramètres du projet »** (engrenage).
2. Descendez jusqu'à la section **« Propriétés du script »** et cliquez sur
   **« Ajouter une propriété »**.
3. Renseignez :
   - **Propriété** : `SEND_TO`
   - **Valeur** : `holdingnormandie@gmail.com`
4. Cliquez sur **« Enregistrer la propriété »**, puis revenez à l'éditeur de code.

> ⚠️ Le plus simple est de créer et configurer ce projet **avec le compte
> `holdingnormandie@gmail.com` lui-même** : le client est alors propriétaire du script,
> des e-mails et de la feuille de logs. L'adresse de réception peut toutefois rester
> `holdingnormandie@gmail.com` même si le projet est monté sur un autre compte.

> 💡 Pour changer l'adresse plus tard : modifiez uniquement la **valeur** de la propriété
> `SEND_TO` et enregistrez. **Aucun redéploiement nécessaire, l'URL `/exec` ne change pas.**
> Si la propriété `SEND_TO` n'existe pas ou est vide, le script n'envoie rien et inscrit
> `send_to_non_config` dans les logs (voir « Suivi des demandes »).

## Étape 4 — Autoriser le script

1. Dans la barre de menu, ouvrez la liste déroulante **« exécuter »** et choisissez la
   fonction **`journaliser`** (une fonction vide est alors lancée).
2. Cliquez sur le bouton **« Exécuter »** (▶️).
3. Un panneau « Autorisation requise » s'affiche → **« Examiner les autorisations »**
   → choisissez votre compte → **« Avancé »** → **« Accéder à … (non sécurisé) »** →
   **« Autoriser »**.
   *(Cette étape crée aussi la feuille de logs qui recevra l'historique des demandes.)*
4. Vérifiez que « Exécution terminée » apparaît (sans message rouge).

## Étape 5 — Déployer comme « Application web »

1. Cliquez sur **« Déployer »** (bleu, en haut à droite) → **« Nouveau déploiement »**.
2. Cliquez sur l'icône ⚙️ (engrenage) à côté de « Type de déploiement » → choisissez
   **« Application web »**.
3. Renseignez les champs :
   - **Description** : `Formulaire de contact` (libre).
   - **Exécuter en tant que** : `Moi` (le compte connecté).
   - **Qui a accès** : `Tout le monde` (**indispensable** pour laisser le site envoyer).
4. Cliquez sur **« Déployer »**.
5. Une fenêtre affiche **« Nouveau déploiement créé »**. Dans la colonne de droite,
   copiez l'URL **`Web app`** — elle se termine par `/exec` :
   `https://script.google.com/macros/s/XXXXX/exec`
6. Cliquez sur **« Terminé »**. **Conservez précieusement cette URL.**

## Étape 6 — Vérifier

- Ouvrez l'URL `/exec` dans un onglet : vous devez voir le texte
  « *Endpoint prêt* » — c'est normal.
- Envoyez un test depuis la page contact du site : le message doit arriver sur l'adresse
  réglée à l'étape 3 et être noté dans la feuille de logs (voir étape 7).

## Étape 7 — Transmettre l'URL au développeur

Le site référence l'endpoint dans le fichier `site.js` (ligne « `ENDPOINT =` … »).
**Envoyez votre URL `/exec` au développeur** : il la collera dans `site.js` puis publiera
le site. C'est la seule chose qu'il attend de votre côté.

---

## Suivi des demandes (feuille de logs)

Au premier envoi, le script **crée automatiquement dans le Drive du compte Google** un
tableur intitulé **« Logs formulaire — holding-normandie.com »** avec un onglet
« Soumissions ». Chaque tentative y est inscrite avec son **statut** :

| Statut dans la feuille | Signification |
|---|---|
| `envoye` | E-mail envoyé au client ✅ |
| `faux_*` (honeypot, trop_rapide, mot_spam, trop_de_liens, débit…) | Tentative bloquée ou ignorée par l'antispam |
| `send_to_non_config` | Adresse de réception vide (propriété `SEND_TO` absente — étape 3) |
| `erreur_envoi` | Problème technique (voir colonne « Note ») |

C'est **la source de vérité** : si un visiteur dit avoir envoyé un message, cherchez sa
ligne (et son statut) dans cette feuille.

---

## Dépannage

- **L'URL `/exec` ne répond plus ou renvoie une erreur 401/403** : le déploiement a
  peut-être été modifié ou le script a changé de propriétaire. Rouvrez le projet
  (`script.google.com`) → **« Déployer » → « Gérer les déploiements » → ✏️ Modifier**,
  puis vérifiez à nouveau « Exécuter en tant que : Moi » et « Qui a accès : Tout le monde ».
  Cliquez sur **« Nouvelle version »** et redéployez : **l'URL `/exec` change alors** →
  il faudra transmettre la nouvelle URL au développeur.
- **Je ne reçois pas l'e-mail** : 1) vérifiez la propriété `SEND_TO` dans **⚙️ Paramètres
  du projet → Propriétés du script** (étape 3) ; 2) regardez la feuille de logs — si le
  statut est `envoye`, l'e-mail est parti (pensez à vérifier Spam/Courrier indésirable) ;
  si le statut est `faux_*`, la demande a été bloquée par l'antispam ; si le statut est
  `send_to_non_config`, la propriété `SEND_TO` est vide ou absente.
- **Que faire si le site est validé et le script toujours sur le compte du développeur ?**
  Le script (et la feuille de logs) doivent appartenir au client : le projet Drive peut
  être transféré, mais le plus simple est de refaire les étapes 1 à 5 **directement sur le
  compte Google du client**, puis de transmettre la nouvelle URL `/exec` au développeur.
  *(Le transfert change l'URL + l'émetteur des e-mails → à faire stricte**ment avant** le
  lancement public du site.)*

---

## Limites & sécurité (pour information)

- **Antispam maison inclus** : champ piège invisible, délai minimum de 5 s, filtre
  mots-clés/liens, limite de débit (10 envois/heure, 1 envoi/10 min par adresse), log de
  chaque tentative.
- **Quota Gmail** : ~100 e-mails/jour au-delà de 100 destinataires distincts — largement
  suffisant pour un formulaire de contact.
- Le navigateur ne peut pas lire la réponse de Google (pas d'en-têtes CORS) : la
  confirmation affichée au visiteur est optimiste ; c'est la feuille de logs qui fait foi.