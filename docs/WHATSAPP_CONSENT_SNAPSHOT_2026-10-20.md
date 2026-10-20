# Accord WhatsApp au moment de l’envoi — candidat du 20 octobre 2026

Le CRM a reçu des commandes avec assistance désactivée alors que le propriétaire indique avoir coché la case. La valeur de la requête réelle correspondante n’a pas été observée : aucune cause précise de perte n’est certifiée. L’ancienne capture n’est ni réécrite ni rejouée.

Le checkout lit désormais la case nommée directement dans le formulaire au moment de la soumission, avant les actualisations asynchrones du panier et des frais. La case est indisponible pendant cet envoi. La valeur `true` seule porte la version exacte de notice ; l’absence de case conserve `false`. Un numéro international saisi explicitement reste requis. Le choix n’est pas précoché et n’est pas déduit du réglage CRM administrateur.

La transaction vérifie que le reçu enregistré conserve l’accord validé avant de créer l’événement atomique de transmission. En cas de contradiction, elle échoue. Le client vérifie également le reçu : il refuse de présenter une assistance acceptée si le serveur renvoie un choix ou une notice différents, et affiche une explication demandant de contacter la boutique plutôt que recréer une commande. Une confirmation normale indique que l’accord a été enregistré. Les corps signés, secrets, historique de file, limite de reprise et modes administrateur ne sont pas remplacés.

Validation locale initiale : tests de capture DOM/FormData et formulaire transporteur réussis, compilation backend et lint frontend réussis. La recette complète MongoDB, la compilation frontend et le déploiement restent à vérifier sur cette source finale. Aucun test ne crée une commande réelle, n’envoie de WhatsApp ou ne rejoue un événement historique.
