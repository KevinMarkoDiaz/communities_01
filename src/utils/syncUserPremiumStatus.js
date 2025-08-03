// utils/syncUserPremiumStatus.js
import Business from "../models/business.model.js";
import Event from "../models/event.model.js";

export async function syncUserPremiumStatus(userId, isPremium) {
  // 1. Actualizar negocios
  await Business.updateMany({ owner: userId }, { isPremium });

  // 2. Eventos organizados directamente por el usuario
  await Event.updateMany(
    { "organizer.kind": "User", "organizer.item": userId },
    { isPremium }
  );

  // 3. Eventos organizados por negocios del usuario
  const negocioIds = (await Business.find({ owner: userId }, "_id")).map(
    (b) => b._id
  );

  if (negocioIds.length > 0) {
    await Event.updateMany(
      { "organizer.kind": "Business", "organizer.item": { $in: negocioIds } },
      { isPremium }
    );
  }
}
