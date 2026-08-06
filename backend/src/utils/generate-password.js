import { randomInt } from "node:crypto";

const LOWERCASE_CHARACTERS = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBER_CHARACTERS = "0123456789";
const SPECIAL_CHARACTERS = "!@#$%^&*";

const ALL_CHARACTERS =
  LOWERCASE_CHARACTERS +
  UPPERCASE_CHARACTERS +
  NUMBER_CHARACTERS +
  SPECIAL_CHARACTERS;

const getRandomCharacter = (characters) => characters[randomInt(characters.length)];

const shuffleCharacters = (characters) => {
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const randomIndex = randomInt(index + 1);

    [characters[index], characters[randomIndex]] = [characters[randomIndex], characters[index]];
  }

  return characters;
};

const generatePassword = (length = 12) => {
  if (!Number.isInteger(length) || length < 8) {
    throw new Error(
      "Password length must be an integer greater than or equal to 8",
    );
  }

  const passwordCharacters = [
    getRandomCharacter(LOWERCASE_CHARACTERS),
    getRandomCharacter(UPPERCASE_CHARACTERS),
    getRandomCharacter(NUMBER_CHARACTERS),
    getRandomCharacter(SPECIAL_CHARACTERS),
  ];

  while (passwordCharacters.length < length) {
    passwordCharacters.push(getRandomCharacter(ALL_CHARACTERS));
  }

  return shuffleCharacters(passwordCharacters).join("");
};

export default generatePassword;