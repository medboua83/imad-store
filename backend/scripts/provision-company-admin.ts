import "dotenv/config";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../src/lib/prisma";
import { assertStoreInstallation, storeIdentity } from "../src/lib/store-installation";
async function main() {
    if (!storeIdentity()) throw new Error("Un profil entreprise indépendant est requis");
    const email = z.string().email().parse(process.env.BOOTSTRAP_ADMIN_EMAIL);
    const password = z.string().min(16).max(128).parse(process.env.BOOTSTRAP_ADMIN_PASSWORD);
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
