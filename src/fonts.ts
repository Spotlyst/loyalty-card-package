export const LOYALTY_CARD_FONT_CATEGORIES = ["sans", "serif", "display", "script", "handwritten", "condensed", "retro", "luxury", "poster", "multilingual"] as const;

import type { LoyaltyCardFontSource } from "./schema.js";

export type LoyaltyCardFontCategory = (typeof LOYALTY_CARD_FONT_CATEGORIES)[number];

export type LoyaltyCardFontCatalogItem = {
  key: string;
  family: string;
  source: "google" | "bunny" | "openSource" | "system";
  category: LoyaltyCardFontCategory;
  weights: number[];
  styles: Array<"normal" | "italic">;
  license: string;
  sourceUrl: string;
};

export const legacyLoyaltyCardFontMap: Record<string, { family: string; key: string; source: LoyaltyCardFontSource }> = {
  sans: { family: "Outfit", key: "outfit", source: "catalog" },
  display_serif: { family: "Playfair Display", key: "playfair-display", source: "catalog" },
  condensed: { family: "Oswald", key: "oswald", source: "catalog" },
  handwritten: { family: "Caveat", key: "caveat", source: "catalog" },
};

const google = (family: string) => `https://fonts.google.com/specimen/${family.replace(/ /g, "+")}`;
const keyFor = (family: string) => family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const fullWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const commonWeights = [300, 400, 500, 600, 700, 800, 900];
const displayWeights = [400, 500, 600, 700, 800, 900];
const singleWeight = [400];

type FontEntry = [string, LoyaltyCardFontCategory, number[]?, Array<"normal" | "italic">?, string?];

const fontEntries: FontEntry[] = [
  ["Outfit", "sans", fullWeights], ["Inter", "sans", fullWeights, ["normal", "italic"]], ["Roboto", "sans", fullWeights, ["normal", "italic"], "Apache-2.0"], ["Open Sans", "sans", fullWeights, ["normal", "italic"], "Apache-2.0"], ["Lato", "sans", fullWeights, ["normal", "italic"], "OFL"], ["Montserrat", "sans", fullWeights, ["normal", "italic"]], ["Poppins", "sans", fullWeights, ["normal", "italic"]], ["Nunito Sans", "sans", commonWeights, ["normal", "italic"]], ["Work Sans", "sans", fullWeights, ["normal", "italic"]], ["Figtree", "sans", commonWeights, ["normal", "italic"]], ["Instrument Sans", "sans", [400, 500, 600, 700], ["normal", "italic"]], ["Raleway", "sans", fullWeights, ["normal", "italic"]], ["Manrope", "sans", [200, 300, 400, 500, 600, 700, 800]], ["Plus Jakarta Sans", "sans", [200, 300, 400, 500, 600, 700, 800], ["normal", "italic"]], ["DM Sans", "sans", fullWeights, ["normal", "italic"]], ["Space Grotesk", "sans", [300, 400, 500, 600, 700]], ["Sora", "sans", [100, 200, 300, 400, 500, 600, 700, 800]], ["Urbanist", "sans", fullWeights, ["normal", "italic"]], ["Lexend", "sans", fullWeights], ["Source Sans 3", "sans", fullWeights, ["normal", "italic"], "OFL"], ["Public Sans", "sans", fullWeights, ["normal", "italic"]], ["IBM Plex Sans", "sans", [100, 200, 300, 400, 500, 600, 700], ["normal", "italic"], "OFL"], ["Karla", "sans", [200, 300, 400, 500, 600, 700, 800], ["normal", "italic"]], ["Mulish", "sans", fullWeights, ["normal", "italic"]], ["Maven Pro", "sans", [400, 500, 600, 700, 800, 900]], ["Questrial", "sans", singleWeight], ["Quicksand", "sans", [300, 400, 500, 600, 700]], ["Josefin Sans", "sans", fullWeights, ["normal", "italic"]], ["Exo 2", "sans", fullWeights, ["normal", "italic"]], ["Jost", "sans", fullWeights, ["normal", "italic"]], ["Barlow", "sans", fullWeights, ["normal", "italic"]], ["Cabin", "sans", [400, 500, 600, 700], ["normal", "italic"]], ["Ubuntu", "sans", [300, 400, 500, 700], ["normal", "italic"]], ["Rubik", "sans", fullWeights, ["normal", "italic"]], ["Noto Sans", "sans", fullWeights, ["normal", "italic"]], ["Alegreya Sans", "sans", fullWeights, ["normal", "italic"]], ["Titillium Web", "sans", [200, 300, 400, 600, 700, 900], ["normal", "italic"]], ["Merriweather Sans", "sans", commonWeights, ["normal", "italic"]], ["PT Sans", "sans", [400, 700], ["normal", "italic"]], ["Heebo", "sans", fullWeights], ["Assistant", "sans", fullWeights], ["Commissioner", "sans", fullWeights], ["Epilogue", "sans", fullWeights, ["normal", "italic"]], ["Geologica", "sans", fullWeights],
  ["Playfair Display", "serif", displayWeights, ["normal", "italic"]], ["Cormorant Garamond", "serif", [300, 400, 500, 600, 700], ["normal", "italic"]], ["Libre Baskerville", "serif", [400, 700], ["normal", "italic"]], ["Lora", "serif", [400, 500, 600, 700], ["normal", "italic"]], ["Fraunces", "serif", fullWeights, ["normal", "italic"]], ["Bitter", "serif", fullWeights, ["normal", "italic"]], ["Spectral", "serif", [200, 300, 400, 500, 600, 700, 800], ["normal", "italic"]], ["Merriweather", "serif", [300, 400, 700, 900], ["normal", "italic"]], ["Source Serif 4", "serif", fullWeights, ["normal", "italic"]], ["Crimson Text", "serif", [400, 600, 700], ["normal", "italic"]], ["EB Garamond", "serif", [400, 500, 600, 700, 800], ["normal", "italic"]], ["Alegreya", "serif", fullWeights, ["normal", "italic"]], ["Petrona", "serif", fullWeights, ["normal", "italic"]], ["Vollkorn", "serif", fullWeights, ["normal", "italic"]], ["Libre Caslon Text", "serif", [400, 700], ["normal", "italic"]], ["Cormorant", "serif", [300, 400, 500, 600, 700], ["normal", "italic"]], ["Domine", "serif", [400, 500, 600, 700]], ["Arvo", "serif", [400, 700], ["normal", "italic"]], ["Roboto Slab", "serif", fullWeights], ["Zilla Slab", "serif", [300, 400, 500, 600, 700], ["normal", "italic"]], ["IBM Plex Serif", "serif", [100, 200, 300, 400, 500, 600, 700], ["normal", "italic"]], ["Noto Serif", "serif", fullWeights, ["normal", "italic"]], ["PT Serif", "serif", [400, 700], ["normal", "italic"]],
  ["Prata", "luxury", singleWeight], ["Cinzel", "luxury", displayWeights], ["Bodoni Moda", "luxury", displayWeights, ["normal", "italic"]], ["Marcellus", "luxury", singleWeight], ["Cormorant SC", "luxury", [300, 400, 500, 600, 700]], ["Bellefair", "luxury", singleWeight], ["Forum", "luxury", singleWeight], ["Gilda Display", "luxury", singleWeight], ["Italiana", "luxury", singleWeight], ["Julius Sans One", "luxury", singleWeight], ["Tenor Sans", "luxury", singleWeight], ["Yeseva One", "luxury", singleWeight], ["Unna", "luxury", [400, 700], ["normal", "italic"]], ["Cardo", "luxury", [400, 700], ["normal", "italic"]],
  ["Abril Fatface", "display", singleWeight], ["Bungee", "display", singleWeight], ["Fredoka", "display", [300, 400, 500, 600, 700]], ["Righteous", "retro", singleWeight], ["Alfa Slab One", "poster", singleWeight], ["Archivo Black", "poster", singleWeight], ["Bowlby One", "poster", singleWeight], ["Anton", "poster", singleWeight], ["Black Han Sans", "poster", singleWeight], ["Changa One", "poster", singleWeight, ["normal", "italic"]], ["Fugaz One", "display", singleWeight], ["Lilita One", "display", singleWeight], ["Paytone One", "display", singleWeight], ["Titan One", "poster", singleWeight], ["Ultra", "poster", singleWeight], ["Shrikhand", "display", singleWeight], ["Monoton", "retro", singleWeight], ["Fascinate", "retro", singleWeight], ["Faster One", "retro", singleWeight], ["Limelight", "retro", singleWeight], ["Bungee Shade", "display", singleWeight], ["Bungee Inline", "display", singleWeight], ["Bungee Outline", "display", singleWeight], ["Bungee Hairline", "display", singleWeight], ["Fira Sans Extra Condensed", "condensed", fullWeights, ["normal", "italic"]], ["Big Shoulders Display", "condensed", fullWeights],
  ["Bebas Neue", "condensed", singleWeight], ["Oswald", "condensed", [200, 300, 400, 500, 600, 700]], ["Barlow Condensed", "condensed", fullWeights, ["normal", "italic"]], ["Roboto Condensed", "condensed", [300, 400, 700], ["normal", "italic"], "Apache-2.0"], ["Teko", "condensed", [300, 400, 500, 600, 700]], ["Archivo Narrow", "condensed", [400, 500, 600, 700], ["normal", "italic"]], ["Antonio", "condensed", [100, 200, 300, 400, 500, 600, 700]], ["League Gothic", "condensed", singleWeight], ["Pathway Gothic One", "condensed", singleWeight], ["Staatliches", "condensed", singleWeight], ["Six Caps", "condensed", singleWeight], ["Yanone Kaffeesatz", "condensed", [200, 300, 400, 500, 600, 700]], ["Economica", "condensed", [400, 700], ["normal", "italic"]],
  ["Pacifico", "script", singleWeight], ["Satisfy", "script", singleWeight], ["Dancing Script", "script", [400, 500, 600, 700]], ["Great Vibes", "script", singleWeight], ["Courgette", "script", singleWeight], ["Lobster", "script", singleWeight], ["Lobster Two", "script", [400, 700], ["normal", "italic"]], ["Cookie", "script", singleWeight], ["Allura", "script", singleWeight], ["Alex Brush", "script", singleWeight], ["Sacramento", "script", singleWeight], ["Parisienne", "script", singleWeight], ["Kaushan Script", "script", singleWeight], ["Yellowtail", "script", singleWeight], ["Norican", "script", singleWeight], ["Playball", "script", singleWeight], ["Grand Hotel", "script", singleWeight], ["Oleo Script", "script", [400, 700]], ["Leckerli One", "script", singleWeight],
  ["Permanent Marker", "handwritten", singleWeight, ["normal"], "Apache-2.0"], ["Caveat", "handwritten", [400, 500, 600, 700]], ["Kalam", "handwritten", [300, 400, 700]], ["Patrick Hand", "handwritten", singleWeight], ["Gloria Hallelujah", "handwritten", singleWeight], ["Indie Flower", "handwritten", singleWeight], ["Shadows Into Light", "handwritten", singleWeight], ["Shadows Into Light Two", "handwritten", singleWeight], ["Architects Daughter", "handwritten", singleWeight], ["Handlee", "handwritten", singleWeight], ["Coming Soon", "handwritten", singleWeight], ["Gochi Hand", "handwritten", singleWeight], ["Just Another Hand", "handwritten", singleWeight], ["Schoolbell", "handwritten", singleWeight], ["Reenie Beanie", "handwritten", singleWeight], ["Covered By Your Grace", "handwritten", singleWeight], ["Nothing You Could Do", "handwritten", singleWeight], ["Rock Salt", "handwritten", singleWeight], ["Nanum Pen Script", "handwritten", singleWeight],
  ["Hind", "multilingual", [300, 400, 500, 600, 700]], ["Noto Sans Devanagari", "multilingual", fullWeights], ["Noto Serif Devanagari", "multilingual", fullWeights], ["Baloo 2", "multilingual", [400, 500, 600, 700, 800]], ["Yatra One", "display", singleWeight], ["Mukta", "multilingual", [200, 300, 400, 500, 600, 700, 800]], ["Palanquin", "multilingual", [100, 200, 300, 400, 500, 600, 700]], ["Tiro Devanagari Hindi", "multilingual", [400], ["normal", "italic"]], ["Noto Sans Bengali", "multilingual", fullWeights], ["Noto Serif Bengali", "multilingual", fullWeights], ["Noto Sans Tamil", "multilingual", fullWeights], ["Noto Serif Tamil", "multilingual", fullWeights], ["Noto Sans Telugu", "multilingual", fullWeights], ["Noto Sans Kannada", "multilingual", fullWeights], ["Noto Sans Malayalam", "multilingual", fullWeights], ["Noto Sans Gujarati", "multilingual", fullWeights], ["Noto Sans Gurmukhi", "multilingual", fullWeights], ["Noto Sans Oriya", "multilingual", fullWeights],
];

export const loyaltyCardFontCatalog: LoyaltyCardFontCatalogItem[] = fontEntries.map(([family, category, weights = [400, 700], styles = ["normal"], license = "OFL"]) => ({
  key: keyFor(family),
  family,
  source: "google",
  category,
  weights,
  styles,
  license,
  sourceUrl: google(family),
}));

export function findLoyaltyCardFont(keyOrFamily: string) {
  const normalized = keyOrFamily.trim().toLowerCase();
  return loyaltyCardFontCatalog.find((font) => font.key === normalized || font.family.toLowerCase() === normalized) || null;
}

export function getLoyaltyCardFontCategoryLabel(category: LoyaltyCardFontCategory) {
  return category.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
