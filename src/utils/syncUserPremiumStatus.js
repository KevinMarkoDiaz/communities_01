// utils/syncUserPremiumStatus.js
import Business from "../models/business.model.js";
import Event from "../models/event.model.js";
import Promotion from "../models/promotion.model.js";

export async function syncUserPremiumStatus(userId, isPremium) {
  // 1. Actualizar negocios del usuario
  await Business.updateMany({ owner: userId }, { isPremium });

  // 2. Eventos organizados directamente por el usuario
  await Event.updateMany(
    { "organizer.kind": "User", "organizer.item": userId },
    { isPremium }
  );

  // 3. Obtener negocios del usuario
  const negocioIds = (await Business.find({ owner: userId }, "_id")).map(
    (b) => b._id
  );

  if (negocioIds.length > 0) {
    // 4. Eventos organizados por esos negocios
    await Event.updateMany(
      { "organizer.kind": "Business", "organizer.item": { $in: negocioIds } },
      { isPremium }
    );

    // 5. Promociones de esos negocios
    await Promotion.updateMany(
      { business: { $in: negocioIds } },
      { isPremium }
    );
  }

  // 6. Promociones creadas directamente por el usuario
  await Promotion.updateMany({ createdBy: userId }, { isPremium });
}
