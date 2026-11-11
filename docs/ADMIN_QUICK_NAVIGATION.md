# Accès rapide aux réglages et aux commandes

Les références de « Dernières commandes » ouvrent la fiche correspondante, sans action sur son statut. Le lien contient `tab=orders&order=...`, exige la session habituelle et ne donne accès qu’aux commandes présentes dans la liste autorisée. Une commande plus ancienne que les 100 chargées ou retirée affiche « Commande indisponible ». Aucun nouvel accès API n’est ajouté.

Dans Paramètres, les raccourcis mènent aux réseaux sociaux/WhatsApp, à la confirmation des commandes, au transporteur, aux règles de livraison, aux délais et retours et à Meta Pixel. Sur mobile, une liste native remplace les six cartes. La navigation ne soumet aucun formulaire et ne remonte pas les composants ; les brouillons restent en mémoire.

La confirmation directe distingue le choix modifié du choix enregistré. Un rechargement pendant une modification ou une sauvegarde demande confirmation ; une erreur de sauvegarde conserve le choix pour un nouvel essai. Les modifications ne sont pas sauvegardées automatiquement et ne sont pas conservées après une fermeture volontairement confirmée.

Validation ciblée : `tests/ui/admin-quick-navigation.spec.ts`, avec API simulée, données fictives, erreurs de sauvegarde, rechargement, clavier, historique, français/arabe et formats 320/390/1440 px. Les régressions existantes du dashboard et des réglages doivent aussi passer avant publication. Aucun ordre ni appel CRM/WhatsApp/transporteur réel ne fait partie des tests.
