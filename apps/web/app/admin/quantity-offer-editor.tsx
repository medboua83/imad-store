"use client";
import {
    quantityDiscountError,
    quantityTotalPrice,
    type QuantityDiscount,
} from "@imad-store/shared";
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
                Saisissez le <strong>total pour la quantité indiquée</strong>. Les tailles et
                couleurs du même produit se cumulent. Sans offre, le total est simplement le prix
                d’une pièce multiplié par la quantité.
            </p>
            {offers.map((offer, index) => (
                <div className="quantity-admin-row" key={index}>
                    <label>
                        Quantité minimum
                        <input
                            className="admin-field"
                            type="number"
                            required
                            min={2}
                            max={100}
                            step={1}
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
                disabled={!ready || offers.length >= 5 || offers.some((offer) => Number(offer.minQuantity) >= 100)}
                onClick={() => {
                    const quantity =
                        Math.max(1, ...offers.map((o) => Number(o.minQuantity) || 1)) + 1;
                    onChange([
                        ...offers,
                        {
                            minQuantity: String(quantity),
                            totalPrice: (Math.floor(((!error && tiers.at(-1)?.unitPrice) || price) * quantity * 100 + 0.000001) / 100).toFixed(2),
                        },
                    ]);
                }}
            >
                Ajouter une offre
            </button>
            {!ready && <p>Renseignez d’abord le prix d’une pièce.</p>}
            {!!error && offers.every((o) => o.minQuantity && o.totalPrice) && (
                <p role="alert" className="admin-alert">
                    {error}
                </p>
            )}
            {ready && (
                <div
                    className="quantity-preview"
                    aria-label="Aperçu des prix par quantité"
                    aria-live="polite"
                >
                    <h4>Ce que le client paiera</h4>
                    <div className="quantity-preview-grid">
                        {[1, 2, 3, 4, 5].map((quantity) => {
                            const total = quantityTotalPrice(price, error ? [] : tiers, quantity),
                                saving = Math.round((price * quantity - total) * 100) / 100;
                            return (
                                <div key={quantity}>
                                    <span>
                                        {quantity} {quantity === 1 ? "pièce" : "pièces"}
                                    </span>
                                    <strong>{money(total)}</strong>
                                    <small>
                                        {saving > 0
                                            ? `${money(saving)} économisés`
                                            : "Tarif standard"}
                                    </small>
                                </div>
                            );
                        })}
                    </div>
                    <p>
                        Hors livraison. À partir du palier atteint, le même prix moyen s’applique
                        aux quantités suivantes. Le total est arrondi au centime ; le prix barré
                        n’ajoute pas une seconde remise.
                    </p>
                </div>
            )}
        </fieldset>
    );
}
