export const PASSWORD_MIN_LENGTH = 10;

export const PASSWORD_HINT =
  "Mínimo 10 caracteres, con al menos una letra y un número. Evita contraseñas habituales.";

export const passwordRules = (required: boolean) => [
  { required, message: "Ingresa la contraseña" },
  { min: PASSWORD_MIN_LENGTH, message: `Mínimo ${PASSWORD_MIN_LENGTH} caracteres` },
  { max: 72, message: "Máximo 72 caracteres" },
  {
    pattern: /[A-Za-z]/,
    message: "Debe incluir al menos una letra",
  },
  {
    pattern: /\d/,
    message: "Debe incluir al menos un número",
  },
];
