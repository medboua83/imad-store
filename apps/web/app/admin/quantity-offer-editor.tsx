"use client";
import { quantityDiscountError, type QuantityDiscount } from "@imad-store/shared";
import { money } from "./admin-utils";
export type DraftQuantityOffer = { minQuantity: string; totalPrice: string };
export function packOffers(price: number, drafts: DraftQuantityOffer[]): QuantityDiscount[] {
    const offers = drafts
        .map((draft) => ({
            minQuantity: Number(draft.minQuantity),
            totalPrice: Number(draft.totalPrice),
            unitPrice: Number(draft.totalPrice) / Number(draft.minQuantity),
        }))
        .sort((a, b) => a.minQuantity - b.minQuantity);
    const error = quantityDiscountError(price, offers);
    if (error) throw new Error(error);
    return offers;
}
export function QuantityOfferEditor({
    price,
    offers,
    onChange,
    disabled,
}: {
    price: number;
    offers: DraftQuantityOffer[];
    onChange: (offers: DraftQuantityOffer[]) => void;
    disabled: boolean;
}) {
    let error = "",
        tiers: QuantityDiscount[] = [];
    try {
        tiers = packOffers(price, offers);
    } catch (failure) {
        error = (failure as Error).message;
    }
    const ready = price > 0 && Number.isFinite(price);
    return (
        <fieldset className="quantity-admin" disabled={disabled}>
            <legend>Promotions par quantité</legend>
            <p>
                Saisissez vous-même <strong>la quantité et le total de chaque offre</strong>. Aucun
                montant n’est proposé automatiquement. Les tailles et couleurs du même produit se
                cumulent. Chaque lot complet bénéficie de son prix saisi ; les pièces restantes
                gardent le prix normal. Le plus petit lot se répète ; un prix spécial saisi pour la
                quantité exacte est toujours prioritaire.
            </p>
            {offers.map((offer, index) => (
                <div className="quantity-admin-row" key={index}>
                    <label>
                        Quantité de l’offre
                        <input
                            className="admin-field"
                            type="number"
                            required
                            min={2}
                            max={100}
                            step={1}
                            placeholder="Ex. 2"
                            value={offer.minQuantity}
                            onChange={(e) =>
                                onChange(
                                    offers.map((o, i) =>
                                        i === index ? { ...o, minQuantity: e.target.value } : o,
                                    ),
                                )
                            }
                        />
                    </label>
                    <label>
                        Total du lot (MAD)
                        <input
                            className="admin-field"
                            type="number"
                            required
                            min={Math.max(0.01, Number(offer.minQuantity) / 100)}
                            max={ready ? Number(offer.minQuantity) * price : 100000000}
                            step="0.01"
                            placeholder="À saisir"
                            value={offer.totalPrice}
                            onChange={(e) =>
                                onChange(
                                    offers.map((o, i) =>
                                        i === index ? { ...o, totalPrice: e.target.value } : o,
                                    ),
                                )
                            }
                        />
                    </label>
                    <button
                        className="admin-button"
                        type="button"
                        aria-label={`Supprimer l’offre ${index + 1}`}
                        onClick={() => onChange(offers.filter((_, i) => i !== index))}
                    >
                        Retirer
                    </button>
                    {Number(offer.minQuantity) > 0 && Number(offer.totalPrice) > 0 && (
                        <p>
                            {offer.minQuantity} pièces ={" "}
                            <strong>{money(Number(offer.totalPrice))}</strong> · environ{" "}
                            {money(Number(offer.totalPrice) / Number(offer.minQuantity))} par pièce.
                        </p>
                    )}
                </div>
            ))}
            <button
                className="admin-button"
                type="button"
                disabled={!ready || offers.length >= 5}
                onClick={() => onChange([...offers, { minQuantity: "", totalPrice: "" }])}
            >
                Ajouter une offre
            </button>
            {!ready && <p>Renseignez d’abord le prix d’une pièce.</p>}
            {!!error && offers.every((o) => o.minQuantity && o.totalPrice) && (
                <p role="alert" className="admin-alert">
                    {error}
                </p>
            )}
            {ready && offers.length === 0 && (
                <p>Aucune promotion par quantité. Le prix normal de la pièce s’applique.</p>
            )}
            {ready && offers.length > 0 && !error && (
                <div
                    className="quantity-preview"
                    aria-label="Offres saisies manuellement"
                    aria-live="polite"
                >
                    <h4>Offres saisies manuellement</h4>
                    <div className="quantity-preview-grid">
                        {tiers.map((tier) => {
                            const quantity = tier.minQuantity,
                                total = tier.totalPrice ?? tier.unitPrice * quantity,
                                saving = Math.round((price * quantity - total) * 100) / 100;
                            return (
                                <div key={quantity}>
                                    <span>
                                        {quantity} {quantity === 1 ? "pièce" : "pièces"}
                                    </span>
                                    <strong>{money(total)}</strong>
                                    <small>
                                        {saving > 0 ? `${money(saving)} économisés` : "Total saisi"}
                                    </small>
                                </div>
                            );
                        })}
                    </div>
                    <p>
                        Seuls vos lots saisis sont présentés ici. Ils peuvent se répéter ; les
                        pièces hors lot restent au prix normal. Un prix saisi pour la quantité
                        exacte remplace ce calcul. Hors livraison. Le prix barré n’ajoute pas une
                        seconde remise.
                    </p>
                </div>
            )}
        </fieldset>
    );
}
