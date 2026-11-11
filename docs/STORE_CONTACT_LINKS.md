# Liens des réseaux et contact WhatsApp

Dans **Administration → Paramètres → Réseaux sociaux et WhatsApp**, modifiez les liens Instagram, Facebook et TikTok et le numéro ou le lien WhatsApp, puis cliquez sur **Enregistrer les liens**. Un bouton permet de vérifier chaque adresse dans un nouvel onglet. Vider un champ masque ce réseau après enregistrement.

WhatsApp accepte un numéro international avec indicatif (par exemple +212 600 000 000), un lien `https://wa.me/…` ou `https://api.whatsapp.com/send?phone=…`. Un numéro local sans indicatif est refusé. Le même contact s’affiche dans le pied de page, le bouton flottant et la page Contact. Le choix de l’agent IA et la connexion WhatsApp du CRM restent des réglages distincts.

Le formulaire existe en français et en arabe. Il garde la saisie après une erreur de réseau, empêche une double soumission et avertit avant un rechargement avec des modifications non enregistrées. Les autres sections des Paramètres ne sont pas modifiées par cet enregistrement.

## Installation et publication

La migration `20261111170000_store_contact_links` ajoute quatre colonnes facultatives à `store_settings`. Elle ne supprime ni ne renomme rien. Les valeurs NULL conservent les liens historiques ; les chaînes vides masquent explicitement les boutons. Les lectures publiques normalisent les liens avant affichage, y compris le lecteur utilisé par le serveur combiné. Les écritures demandent une session administrateur et refusent HTTP, scripts, identifiants dans les URL, domaines étrangers et ports non standards.

Exécuter les migrations avec le compte de migration dédié avant de démarrer le nouveau serveur. Le précédent serveur reste compatible avec ces colonnes supplémentaires en cas de retour arrière. Ne pas réinitialiser la base et ne pas utiliser `prisma db push` en production.

## Validation

Scénarios navigateur isolés à 390 et 1440 px avec données fictives, français/arabe, URL incorrecte, échec puis nouvel essai de sauvegarde, rechargement, masquage d’un réseau et de WhatsApp et cohérence des liens sur la boutique. Les tests API PostgreSQL vérifient les droits, la persistance, les valeurs historiques et la conservation des réglages commerciaux. Aucun compte réel ni coordonnées de client ne sont utilisés pour ces écritures de test.
