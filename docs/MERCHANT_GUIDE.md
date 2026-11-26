# Guide marchand

## Démarrer

Ouvrir `/admin`, se connecter avec son compte personnel puis ouvrir **Mon compte**. Activer la double authentification avec son application et conserver les codes de secours dans un endroit séparé. Le propriétaire ne doit pas partager un compte administrateur entre les caissiers.

Dans **Paramètres → Préparation de la boutique**, consulter les points à terminer, affichés en premier. Les contrôles satisfaits restent accessibles dans un volet replié, au clavier comme au toucher. Le bilan est en lecture seule ; il ne modifie ni réglage, ni commande, ni envoi. La date affichée correspond à la dernière lecture, à l’heure du Maroc fournie par le serveur, même si l’appareil utilise un autre fuseau ou des règles horaires anciennes. Un bilan non actualisé ne constitue pas une nouvelle validation. Le raccourci SMTP ouvre directement **E-mails et SMTP** pour les administrateurs.

## Identité et contacts

Dans **Paramètres → Identité de la boutique**, modifier le nom, importer les logos pour fond clair et sombre, choisir les couleurs puis compléter e-mail, téléphone et adresse. L'aperçu reste privé jusqu'au bouton de publication. Les liens sociaux et WhatsApp ont leur propre section. L'e-mail public n'est pas la configuration SMTP et le nom commercial ne remplace pas l'identité juridique.

Dans **Contenu**, compléter le nom et l'adresse juridiques, la livraison, les retours et la confidentialité. Cocher la validation seulement après vérification des textes propres au marchand. Aucun modèle générique ne certifie sa conformité légale.

## Produits et photos

Créer d'abord un brouillon. Renseigner titre, catégorie, prix et variantes. Associer à chaque couleur les photos correspondantes dans le sélecteur de photos et couleurs. Vérifier l'aperçu de la fiche, les tailles et le stock avant de publier. Utiliser ses propres médias ; ne pas reprendre les photos d'une autre boutique sans droit de réutilisation.

Le stock est défini par variante, pas seulement par produit. Ne pas créer une deuxième fiche pour corriger une réponse réseau incertaine : utiliser la récupération ou l'actualisation proposées par l'éditeur.

## Commandes

La recherche porte sur l'historique complet. Les raccourcis Aujourd'hui, 7, 30 et 90 jours complètent les autres filtres. Vérifier les dates, le nombre de résultats et les filtres avant d'exporter ; un export contient des données personnelles et doit rester privé.

Le repère d'annulations antérieures concerne le numéro de téléphone. Une validation d'expédition manuelle vaut pour une seule commande, pas pour toutes les futures commandes de ce numéro. Confirmation, création du colis, livraison et paiement sont des étapes distinctes. Ne pas changer un paiement pour résoudre une différence de suivi transporteur.

En cas d'envoi au résultat incertain, consulter le suivi et le compte transporteur avant toute nouvelle création. Ne pas dupliquer le colis pour faire disparaître une alerte. Les incidents sont signalés dans le bilan des réglages ; ce bilan ne relance aucun envoi.

## Caisse

Chaque caissier ouvre sa propre session avec le fond initial, choisit la bonne variante et vérifie le récapitulatif avant d'encaisser. Un paiement par carte correspond à un encaissement déjà réalisé sur un terminal externe, pas à une transaction bancaire effectuée par ce site.

En cas de coupure après validation, reprendre la tentative existante pour retrouver le ticket plutôt que recommencer une vente. Pour un retour, choisir obligatoirement si chaque article est revendable ; seule cette quantité est réintégrée. Le remboursement en espèces et le complément d'un échange sont comptabilisés dans la session. À la fermeture, compter les espèces et justifier un écart. Voir le [guide caisse](CAISSE.md).

## Équipe et e-mails

Créer un compte personnel avec seulement les rubriques utiles. Les permissions sont vérifiées par le serveur. Ne pas envoyer un mot de passe dans un message : utiliser une invitation ou un lien de réinitialisation lorsque le SMTP est opérationnel.

Dans **E-mails et SMTP**, enregistrer l'adresse Gmail, un mot de passe d'application Google et activer la connexion. La vérification de connexion ne transmet pas d'e-mail. Avant remise, vérifier aussi la réception d'une invitation et d'un lien de récupération, leur expiration et leur usage unique. Gmail exige la validation en deux étapes pour créer un mot de passe d'application : [aide Google](https://support.google.com/mail/answer/185833?hl=fr).

Ne jamais recopier les mots de passe SMTP, les liens de récupération ou les codes MFA dans les journaux, un ticket de support ou le dépôt Git.

## Sauvegardes et assistance

Les sauvegardes chiffrées et leur clé ne doivent pas être conservées ensemble. Vérifier la date du dernier reçu de restauration et garder un moyen indépendant de récupérer les clés. Un système utilisant un Mac et un disque externe dépend de leur disponibilité ; il ne garantit pas une copie lorsque le matériel est éteint ou déconnecté.

Pour demander de l'aide, transmettre la référence de commande, l'heure et le message d'erreur utile, sans coordonnées du client ou secret. Le nom d'un statut et une capture masquée suffisent généralement. Ne pas joindre un export de clients ou une sauvegarde complète sans un canal privé et une autorisation adaptée.

## Terminer la remise

Suivre le [parcours de finalisation](FINAL_SETUP.md) pour distinguer les réglages personnels, la réception réelle des e-mails et les essais sur appareils. La [présentation du catalogue et des statistiques](STOREFRONT_DISPLAY.md) décrit les filtres et le format des prix.
