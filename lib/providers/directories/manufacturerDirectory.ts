/**
 * Curated directory of private, regional, and specialty manufacturers,
 * contract packagers, and distributors not well covered by SEC or FDA alone.
 */

export type ManufacturerCategory =
  | "food"
  | "pharma"
  | "packaging"
  | "contract-packaging"
  | "distribution"
  | "beverage";

export interface ManufacturerDirectoryEntry {
  id: string;
  name: string;
  website: string;
  state: string;
  region: string;
  category: ManufacturerCategory;
  products: string[];
  facilityType: string;
  aliases: string[];
}

export const MANUFACTURER_DIRECTORY: ManufacturerDirectoryEntry[] = [
  {
    id: "dir-mf-schreiber",
    name: "Schreiber Foods",
    website: "https://www.schreiberfoods.com",
    state: "WI",
    region: "midwest",
    category: "food",
    products: ["dairy", "cheese", "yogurt", "custom dairy formulations"],
    facilityType: "private dairy processing",
    aliases: ["schreiber foods", "schreiber"],
  },
  {
    id: "dir-mf-bellisio",
    name: "Bellisio Foods",
    website: "https://www.bellisio.com",
    state: "MN",
    region: "midwest",
    category: "food",
    products: ["frozen entrees", "retail meals", "foodservice"],
    facilityType: "frozen food manufacturing",
    aliases: ["bellisio foods", "bellisio"],
  },
  {
    id: "dir-mf-del-real",
    name: "Del Real Foods",
    website: "https://www.delrealfoods.com",
    state: "CA",
    region: "west",
    category: "food",
    products: ["prepared Mexican foods", "refrigerated meals", "salsas"],
    facilityType: "regional prepared foods plant",
    aliases: ["del real foods", "del real"],
  },
  {
    id: "dir-mf-ryt-way",
    name: "Ryt-way Industries",
    website: "https://www.rytway.com",
    state: "MN",
    region: "midwest",
    category: "contract-packaging",
    products: ["dry blending", "contract packaging", "seasonings"],
    facilityType: "contract packaging / co-packing",
    aliases: ["ryt-way", "ryt way industries", "rytway"],
  },
  {
    id: "dir-mf-ameripak",
    name: "AmeriPak",
    website: "https://www.ameripak.com",
    state: "PA",
    region: "mid-atlantic",
    category: "contract-packaging",
    products: ["contract packaging", "blister packaging", "pouches"],
    facilityType: "contract packager",
    aliases: ["ameripak", "ameri pak"],
  },
  {
    id: "dir-mf-agrofresh",
    name: "AgroFresh",
    website: "https://www.agrofresh.com",
    state: "PA",
    region: "mid-atlantic",
    category: "food",
    products: ["post-harvest solutions", "fresh produce preservation"],
    facilityType: "specialty food ingredients",
    aliases: ["agrofresh"],
  },
  {
    id: "dir-mf-kehe",
    name: "KeHE Distributors",
    website: "https://www.kehe.com",
    state: "IL",
    region: "midwest",
    category: "distribution",
    products: ["natural and organic food distribution", "specialty grocery"],
    facilityType: "regional food distributor",
    aliases: ["kehe", "kehe distributors"],
  },
  {
    id: "dir-mf-unipro",
    name: "UniPro Foodservice",
    website: "https://www.uniprofoodservice.com",
    state: "GA",
    region: "southeast",
    category: "distribution",
    products: ["foodservice distribution", "independent operator supply"],
    facilityType: "regional distributor",
    aliases: ["unipro", "unipro foodservice"],
  },
  {
    id: "dir-mf-harbor-cold",
    name: "Harbor Cold Storage",
    website: "https://www.harborcoldstorage.com",
    state: "WA",
    region: "west",
    category: "food",
    products: ["cold storage", "co-packing", "frozen logistics"],
    facilityType: "cold storage and co-packing",
    aliases: ["harbor cold storage", "harbor cold"],
  },
  {
    id: "dir-mf-bartek",
    name: "Bartek Ingredients",
    website: "https://www.bartek.ca",
    state: "ON",
    region: "midwest",
    category: "food",
    products: ["food acidulants", "malic acid", "fumaric acid"],
    facilityType: "specialty ingredients manufacturing",
    aliases: ["bartek ingredients", "bartek"],
  },
];
