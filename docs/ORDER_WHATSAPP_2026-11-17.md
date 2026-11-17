# Contact WhatsApp depuis une commande

La fiche de commande du dashboard propose « Contacter sur WhatsApp » quand un numéro exploitable est disponible. Le lien ouvre un brouillon, sans envoi automatique ni changement du statut de la commande. Le commerçant vérifie le texte et l'envoie dans WhatsApp.

Le message français comprend la référence complète, le nom du client, chaque article, les tailles/couleurs disponibles, les SKU, quantités, prix unitaires et montants, le sous-total, les frais de livraison enregistrés, le total enregistré, l'adresse, le téléphone, le paiement à la livraison et la note client si présents. Des frais inconnus ne deviennent pas zéro ; un détail incohérent avec le total est signalé. Les anciens champs de contact/adresse restent pris en charge.

Chaque article inclut le lien HTTP(S) de sa photo, sélectionnée avec la même correspondance couleur que la fiche dashboard. Une URL relative utilise l'origine du site. WhatsApp peut proposer un aperçu mais le lien ne joint pas une photo et son aperçu n'est pas garanti. Aucun lien privé du dashboard ni nouvelle page publique de commande n'est créé. Le texte commercial reste français même lorsque les commandes du dashboard sont affichées en arabe.

Validation locale : quatre tests de génération du brouillon, trois tests navigateur avec commandes fictives (320/390/1440 px), lint et compilation de production. Aucun message envoyé, aucune commande ni expédition créée. Audit des dépendances : zéro vulnérabilité détectée. Publication sur VPS à vérifier séparément.
