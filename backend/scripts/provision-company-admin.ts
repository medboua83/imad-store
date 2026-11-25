import "dotenv/config";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../src/lib/prisma";
import { assertStoreInstallation, storeIdentity } from "../src/lib/store-installation";
import { defaultSiteContent } from "@imad-store/shared";
async function main() {
    const identity = storeIdentity();
    if (!identity) throw new Error("Un profil indépendant est requis");
    const email = z.string().email().parse(process.env.BOOTSTRAP_ADMIN_EMAIL);
    const password = z.string().min(16).max(128).refine(value => Buffer.byteLength(value, "utf8") <= 72).parse(process.env.BOOTSTRAP_ADMIN_PASSWORD);
    await assertStoreInstallation();
    // An immutable claim prevents two concurrent bootstrap requests creating different admins.
    await prisma.$transaction(async (tx) => {
        if (await tx.user.count())
            throw new Error("Un compte existe déjà. Initialisation refusée.");
        const installation = await tx.storeInstallation.findUniqueOrThrow({
            where: { id: "installation" },
        });
        // The write makes concurrent bootstrap transactions conflict; no existing account is reset.
        await tx.storeInstallation.update({
            where: { id: installation.id },
            data: { initialized: true },
        });
        await tx.user.create({
            data: {
                email,
                passwordHash: await bcrypt.hash(password, 12),
                firstName: "Administrateur",
                lastName: "Boutique",
                role: "ADMIN",
            },
        });
        // New installations start with their own name and no inherited IMAD contact or tracker.
        const name = process.env.STORE_DISPLAY_NAME?.trim();
        if (!name) throw new Error("Le nom de cette boutique est requis");
        await tx.storeBranding.create({ data: { id: "store", data: { name } } });
        await tx.storeSettings.create({ data: { id: "settings", whatsappPhone: "",
            whatsappUrl: "", instagramUrl: "", facebookUrl: "", tiktokUrl: "",
            directSiteConfirmation: identity.companyId === null, metaPixelEnabled: false, metaPixelId: null } });
        const content = { ...defaultSiteContent, businessName: name, heroImage: "", policiesVerified: false };
        await tx.siteContent.create({ data: { id: "site", draft: content, published: content } });
    });
    console.log("Premier administrateur créé ; aucun identifiant affiché.");
}
main()
    .catch(() => {
        console.error(
            "Initialisation refusée. Vérifiez le profil, les identifiants et l’absence de compte existant.",
        );
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
