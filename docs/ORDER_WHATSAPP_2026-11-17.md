# Contact WhatsApp depuis une commande

La fiche de commande du dashboard propose « Contacter sur WhatsApp » quand un numéro exploitable est disponible. Le lien ouvre un brouillon, sans envoi automatique ni changement du statut de la commande. Le commerçant vérifie le texte et l'envoie dans WhatsApp.

Depuis la demande du 18 novembre, le message est en arabe : nom du client, nom de chaque produit (arabe en priorité), taille, couleur et quantité, prix de la ligne, prix des produits, frais de livraison et total enregistré. Les références techniques, SKU, adresse et autres informations du modèle précédent ne sont plus ajoutés au texte commercial. Les frais inconnus et les montants non rapprochés sont signalés en arabe sans inventer de valeur. Les champs historiques du nom/téléphone restent pris en charge.

Chaque article inclut le lien HTTP(S) de sa photo, sélectionnée avec la même correspondance couleur que la fiche dashboard. Une URL relative utilise l'origine du site. WhatsApp peut proposer un aperçu mais le lien ne joint pas une photo et son aperçu n'est pas garanti. Aucun lien privé du dashboard ni nouvelle page publique de commande n'est créé. Le texte commercial reste arabe quelle que soit la langue du dashboard.

Validation locale : quatre tests de génération du brouillon, trois tests navigateur avec commandes fictives (320/390/1440 px), lint et compilation de production. Aucun message envoyé, aucune commande ni expédition créée. Audit des dépendances : zéro vulnérabilité détectée. Publication sur VPS à vérifier séparément.
