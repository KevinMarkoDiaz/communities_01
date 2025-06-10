// src/utils/zodErrorToResponse.js

export function zodErrorToResponse(error) {
  if (!error.errors) return { msg: "Error de validación desconocido" };

  return {
    msg: "Error de validación",
    errors: error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    })),
  };
}
