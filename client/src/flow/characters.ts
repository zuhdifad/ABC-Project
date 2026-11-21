export interface CharacterDef {
  id: string;
  name: string;
  role: string;
  img: string;
}

export const CHARACTERS: CharacterDef[] = [
  { id: "ayu", name: "Ayu", role: "Finance Analyst", img: "/chars/ayu.jpg" },
  { id: "danial", name: "Danial", role: "Operations Executive", img: "/chars/danial.png" },
  { id: "siti", name: "Siti", role: "HR Partner", img: "/chars/siti.png" },
  { id: "marcus", name: "Marcus", role: "IT Support", img: "/chars/marcus.png" }
];

export function charById(id?: string): CharacterDef {
  return CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];
}

export function charTextureKey(id?: string): string {
  return `char_${charById(id).id}`;
}