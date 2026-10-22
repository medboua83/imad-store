# Adresse du formulaire dans le premier message CRM

Le propriétaire demande un seul récapitulatif WhatsApp reprenant le numéro visible sur le site et l’adresse déjà saisie, afin que le client puisse répondre simplement « Oui ».

Diagnostic : le checkout et l’événement de sortie enregistrent bien street, city et region. Le sérialiseur encodeDeskcommForm ne transmettait que Ville dans le champ message effectivement capturé par le CRM. L’agent ne pouvait donc pas lire la rue et devait la redemander. Le numéro du checkout est le suffixe de huit caractères en majuscules, alors que le message CRM affichait l’identifiant complet.

Correction limitée au sérialiseur : le récapitulatif commence par le même numéro public que le checkout, puis conserve l’adresse, la ville et la région. Le champ existant message transporte ces informations en formulaire historique comme en JSON signé, sans nouveau mappage CRM. Le champ pedido_id et les identifiants d’événement restent complets et inchangés pour la recherche et l’idempotence.

Aucun changement des accords WhatsApp, du mode de confirmation SITE, des frais, de la création de commande, de la file historique ou du transporteur. Aucun ancien événement modifié ou rejoué. Aucune adresse réelle ni donnée client enregistrée ici.

Validation locale : neuf tests formulaire/consentement réussis, comprenant adresse française/arabe et concordance du numéro public ; compilation backend et génération Prisma réussies. Un test d’intégration vérifie également les champs dans le corps JSON signé reçu par un simulateur local. Ce dernier doit être exécuté dans la CI MongoDB isolée ; aucun MongoDB local n’était disponible. Publication et déploiement restent à vérifier séparément.

## Publication vérifiée

## Adresse et numéro client CRM publiés — 22 octobre 2026

PR nº 54 fusionnée : 4e19e8092bdffa60d7cfa8687a13e1110503b86e. CI complète réussie, dont le JSON signé reçu par un simulateur local avec rue, ville, région et numéro public ; neuf tests locaux et compilation backend réussis. Hostinger observé Completed / Current sur ce commit ; /health répond ok. La règle native CRM a été enregistrée puis relue : premier message unique commande + adresse et numéro public ; deux aperçus réels du générateur, fictifs, FR/AR réussis sans envoi WhatsApp ni création de colis. Validation humaine avant expédition conservée ; aucun ancien événement rejoué. Les sections de candidat plus anciennes décrivent leur état au moment de leur rédaction. Voir CRM_DELIVERY_ADDRESS_2026-10-22.md.
