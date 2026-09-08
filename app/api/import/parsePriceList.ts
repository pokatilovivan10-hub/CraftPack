import crypto from "node:crypto";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import * as XLSX from "xlsx";
import { parseDecimal } from "./money";

// ─── Типы ────────────────────────────────────────────────────────────────────

export type StockStatus = "in_stock" | "out_of_stock" | "unknown";

export interface ParsedImage {
  hash: string;
  ext: string;
  bytes: Buffer;
  width: number | null;
  height: number | null;
}

export interface ParsedProductRow {
  /** Номер строки в листе, 1-based (как в Excel) */
  rowNumber: number;
  sku: string;
  sourceTitle: string;
  /** Отображаемое название: исходное без дублирующего хвоста «Арт: <тот же SKU>» */
  title: string;
  section: string;
  availabilityRaw: string;
  stockStatus: StockStatus;
  stockQuantity: number | null;
  priceRaw: string;
  /** Нормализованная decimal-строка с 2 знаками или null */
  price: string | null;
  image: ParsedImage | null;
}

export interface ImportIssueData {
  rowNumber: number | null;
  sku: string | null;
  severity: "warning" | "error";
  message: string;
}

export interface ParseResult {
  fileChecksum: string;
  sheetName: string;
  priceDate: string | null;
  products: ParsedProductRow[];
  issues: ImportIssueData[];
  sections: Record<string, number>;
}

/** Настраиваемые алиасы заголовков колонок (для будущих файлов). */
export type HeaderAliases = Record<string, string>;

export const DEFAULT_HEADER_ALIASES: HeaderAliases = {
  "№": "num",
  "Картика": "image", // реальная опечатка в файле
  "Картинка": "image",
  "Артикул": "sku",
  "Наименование": "title",
  "Наличие": "stock",
  "Цена (руб.)": "price",
  "Цена": "price",
  "3%": "discount3", // не интерпретируем как скидку без бизнес-правила
  "8%": "discount8",
  "Заказ": "orderInput",
  "Сумма": "orderSum",
};

const KNOWN_HEADERS = new Set(Object.keys(DEFAULT_HEADER_ALIASES));
const PRICE_DATE_RE = /Актуальность прайса на:\s*(.+)/i;

// ─── Публичная точка входа ───────────────────────────────────────────────────

export async function parsePriceList(
  buffer: Buffer,
  options: { headerAliases?: HeaderAliases } = {},
): Promise<ParseResult> {
  const aliases = { ...DEFAULT_HEADER_ALIASES, ...(options.headerAliases ?? {}) };
  const issues: ImportIssueData[] = [];
  const fileChecksum = crypto.createHash("sha256").update(buffer).digest("hex");

  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = pickSheet(wb);
  if (!sheetName) {
    throw new ImportStructureError(
      'Не найден лист «Прайс-лист» и ни один лист с заголовками «Артикул»/«Наименование».',
    );
  }
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws["!ref"]) {
    throw new ImportStructureError(`Лист «${sheetName}» пуст.`);
  }
  const range = XLSX.utils.decode_range(ws["!ref"]);

  // Изображения, привязанные к строкам (XLSX drawings, колонка B)
  const imageByRow = await extractRowImages(buffer, sheetName, issues);

  let priceDate: string | null = null;
  let currentSection = "";
  let colMap: Record<string, number> | null = null;
  const products: ParsedProductRow[] = [];
  const sections: Record<string, number> = {};
  const skuRows = new Map<string, number>();

  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowVals = readRow(ws, r, range.e.c);
    const nonEmpty = rowVals.filter((v) => v !== "");
    if (nonEmpty.length === 0) continue;

    // Метаданные прайса
    const metaMatch = nonEmpty.join(" ").match(PRICE_DATE_RE);
    if (metaMatch) {
      priceDate = metaMatch[1].trim();
      continue;
    }

    // Строка заголовков — распознаём по содержимому, не по номеру строки
    if (rowVals.includes("Артикул") && rowVals.includes("Наименование")) {
      colMap = buildColMap(rowVals, aliases);
      continue;
    }

    // Строка раздела: единственное текстовое значение в первой колонке
    if (nonEmpty.length === 1 && rowVals[0] !== "" && rowVals[0] !== "№") {
      currentSection = rowVals[0];
      if (!sections[currentSection]) sections[currentSection] = 0;
      continue;
    }

    if (!colMap || colMap.sku === undefined || colMap.title === undefined) continue;

    const skuRaw = rowVals[colMap.sku] ?? "";
    const titleRaw = rowVals[colMap.title] ?? "";
    if (skuRaw === "" || titleRaw === "") continue; // итоговые/служебные строки
    if (KNOWN_HEADERS.has(skuRaw) || skuRaw === "Артикул") continue;

    const rowNumber = r + 1; // 1-based, как в Excel
    const sku = skuRaw.trim();
    const sourceTitle = titleRaw.trim();

    // Дубликаты SKU внутри одного файла — ошибка с номерами строк
    if (skuRows.has(sku)) {
      issues.push({
        rowNumber,
        sku,
        severity: "error",
        message: `Дубликат артикула в файле: строки ${skuRows.get(sku)} и ${rowNumber}.`,
      });
      continue;
    }
    skuRows.set(sku, rowNumber);

    // Наличие: «много» → in_stock без количества; число → точный остаток
    const availabilityRaw = colMap.stock !== undefined ? rowVals[colMap.stock] : "";
    const { stockStatus, stockQuantity } = parseAvailability(availabilityRaw);

    const priceRaw = colMap.price !== undefined ? rowVals[colMap.price] : "";
    const price = parseDecimal(priceRaw);
    if (price === null) {
      issues.push({
        rowNumber,
        sku,
        severity: "warning",
        message: `Не удалось распознать цену «${priceRaw}» — товар получит «Цена по запросу».`,
      });
    }

    const image = imageByRow.get(r) ?? null;
    if (!image) {
      issues.push({
        rowNumber,
        sku,
        severity: "warning",
        message: "Не найдено встроенное изображение в колонке B для этой строки.",
      });
    }

    if (currentSection) sections[currentSection] = (sections[currentSection] ?? 0) + 1;

    products.push({
      rowNumber,
      sku,
      sourceTitle,
      title: stripDuplicateSkuTail(sourceTitle, sku),
      section: currentSection,
      availabilityRaw,
      stockStatus,
      stockQuantity,
      priceRaw,
      price,
      image,
    });
  }

  if (products.length === 0) {
    throw new ImportStructureError("В файле не найдено ни одной товарной строки.");
  }

  return { fileChecksum, sheetName, priceDate, products, issues, sections };
}

export class ImportStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportStructureError";
  }
}

// ─── Ячейки ──────────────────────────────────────────────────────────────────

function pickSheet(wb: XLSX.WorkBook): string | null {
  if (wb.SheetNames.includes("Прайс-лист")) return "Прайс-лист";
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws || !ws["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 60); r++) {
      const vals = readRow(ws, r, range.e.c);
      if (vals.includes("Артикул") && vals.includes("Наименование")) return name;
    }
  }
  return null;
}

function readRow(ws: XLSX.WorkSheet, r: number, maxCol: number): string[] {
  const vals: string[] = [];
  for (let c = 0; c <= Math.min(maxCol, 26); c++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell || cell.v === undefined || cell.v === null) {
      vals.push("");
    } else if (cell.t === "s") {
      vals.push(String(cell.v)); // строки — как есть, включая ведущие нули
    } else {
      // Числа/даты: берём отформатированное представление, если есть
      vals.push(String(cell.w ?? cell.v).trim());
    }
  }
  return vals;
}

function buildColMap(rowVals: string[], aliases: HeaderAliases): Record<string, number> {
  const map: Record<string, number> = {};
  rowVals.forEach((v, idx) => {
    const key = aliases[v];
    if (key && map[key] === undefined) map[key] = idx;
  });
  return map;
}

export function parseAvailability(raw: string): {
  stockStatus: StockStatus;
  stockQuantity: number | null;
} {
  const v = raw.trim().toLowerCase();
  if (v === "") return { stockStatus: "unknown", stockQuantity: null };
  if (v === "много") return { stockStatus: "in_stock", stockQuantity: null };
  if (/^\d+$/.test(v)) {
    const qty = parseInt(v, 10);
    return qty > 0
      ? { stockStatus: "in_stock", stockQuantity: qty }
      : { stockStatus: "out_of_stock", stockQuantity: 0 };
  }
  if (v === "нет" || v === "0") return { stockStatus: "out_of_stock", stockQuantity: 0 };
  return { stockStatus: "unknown", stockQuantity: null };
}

/** Убирает из отображаемого названия только точный дублирующий хвост «Арт: <тот же SKU>». */
export function stripDuplicateSkuTail(title: string, sku: string): string {
  const re = new RegExp(`\\s*Арт:\\s*${escapeRegExp(sku)}\\s*$`, "i");
  return title.replace(re, "").trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Встроенные изображения (XLSX drawings) ──────────────────────────────────

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

async function extractRowImages(
  buffer: Buffer,
  sheetName: string,
  issues: ImportIssueData[],
): Promise<Map<number, ParsedImage>> {
  const result = new Map<number, ParsedImage>();
  const zip = await JSZip.loadAsync(buffer);

  // 1. Лист → файл worksheets/sheetN.xml через workbook.xml + rels
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const workbookRels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbookXml || !workbookRels) return result;

  const wbDoc = xmlParser.parse(workbookXml);
  const relsDoc = xmlParser.parse(workbookRels);
  const sheets = asArray(wbDoc?.workbook?.sheets?.sheet);
  const rels = asArray(relsDoc?.Relationships?.Relationship);
  const relTarget = new Map<string, string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rels.map((r: any) => [r["@_Id"], r["@_Target"]]),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheetEntry = sheets.find((s: any) => s["@_name"] === sheetName);
  const rid = sheetEntry?.["@_r:id"];
  const sheetTarget = rid ? relTarget.get(rid) : null;
  if (!sheetTarget) return result;
  const sheetPath = "xl/" + sheetTarget.replace(/^\//, "").replace(/^xl\//, "");

  // 2. Лист → drawing через rels листа
  const sheetDir = sheetPath.slice(0, sheetPath.lastIndexOf("/"));
  const sheetFile = sheetPath.slice(sheetPath.lastIndexOf("/") + 1);
  const sheetRelsPath = `${sheetDir}/_rels/${sheetFile}.rels`;
  const sheetRelsXml = await zip.file(sheetRelsPath)?.async("string");
  if (!sheetRelsXml) return result;
  const sheetRels = asArray(xmlParser.parse(sheetRelsXml)?.Relationships?.Relationship);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawingRel = sheetRels.find((r: any) =>
    String(r["@_Type"] ?? "").endsWith("/drawing"),
  );
  if (!drawingRel) return result;
  const drawingPath = normalizeZipPath(sheetDir, drawingRel["@_Target"]);

  // 3. Drawing → anchors → media
  const drawingXml = await zip.file(drawingPath)?.async("string");
  const drawingRelsPath = `${drawingPath.slice(0, drawingPath.lastIndexOf("/"))}/_rels/${drawingPath.slice(drawingPath.lastIndexOf("/") + 1)}.rels`;
  const drawingRelsXml = await zip.file(drawingRelsPath)?.async("string");
  if (!drawingXml || !drawingRelsXml) return result;

  const drawingDoc = xmlParser.parse(drawingXml);
  const drawingDir = drawingPath.slice(0, drawingPath.lastIndexOf("/"));
  const dRels = asArray(xmlParser.parse(drawingRelsXml)?.Relationships?.Relationship);
  const embedToMedia = new Map<string, string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dRels.map((r: any) => [r["@_Id"], normalizeZipPath(drawingDir, r["@_Target"])]),
  );

  const root = drawingDoc["xdr:wsDr"] ?? drawingDoc["wsDr"] ?? {};
  const anchors = [
    ...asArray(root["xdr:twoCellAnchor"] ?? root["twoCellAnchor"]),
    ...asArray(root["xdr:oneCellAnchor"] ?? root["oneCellAnchor"]),
  ];

  for (const anchor of anchors) {
    const from = anchor["xdr:from"] ?? anchor["from"];
    if (!from) continue;
    const row = Number(from["xdr:row"] ?? from["row"]);
    const col = Number(from["xdr:col"] ?? from["col"]);
    if (!Number.isInteger(row) || col !== 1) continue; // только колонка B

    const pic = anchor["xdr:pic"] ?? anchor["pic"];
    const blip = pic?.["xdr:blipFill"]?.["a:blip"] ?? pic?.["blipFill"]?.["blip"];
    const embed = blip?.["@_r:embed"];
    const mediaPath = embed ? embedToMedia.get(embed) : null;
    if (!mediaPath) continue;

    const file = zip.file(mediaPath);
    if (!file) continue;
    const bytes = await file.async("nodebuffer");

    const sig = detectSignature(bytes);
    if (!sig) {
      issues.push({
        rowNumber: row + 1,
        sku: null,
        severity: "warning",
        message: `Файл ${mediaPath} не похож на изображение (сигнатура не распознана) — пропущен.`,
      });
      continue;
    }
    const { width, height } = imageSize(bytes);
    result.set(row, {
      hash: crypto.createHash("sha256").update(bytes).digest("hex"),
      ext: sig,
      bytes,
      width,
      height,
    });
  }
  return result;
}

function normalizeZipPath(baseDir: string, target: string): string {
  const parts = [...baseDir.split("/"), ...target.split("/")];
  const out: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

function asArray<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

function detectSignature(b: Buffer): "png" | "jpg" | "gif" | "webp" | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "webp";
  return null;
}

/** Размеры PNG/JPEG/GIF из заголовков, без внешних зависимостей. */
export function imageSize(b: Buffer): { width: number | null; height: number | null } {
  try {
    // PNG
    if (b[0] === 0x89 && b[1] === 0x50) {
      return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    }
    // GIF
    if (b[0] === 0x47 && b[1] === 0x49) {
      return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
    }
    // JPEG: ищем SOF0..SOF15
    if (b[0] === 0xff && b[1] === 0xd8) {
      let off = 2;
      while (off + 9 < b.length) {
        if (b[off] !== 0xff) {
          off++;
          continue;
        }
        const marker = b[off + 1];
        const len = b.readUInt16BE(off + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: b.readUInt16BE(off + 5), width: b.readUInt16BE(off + 7) };
        }
        off += 2 + len;
      }
    }
  } catch {
    // игнорируем — размеры не критичны
  }
  return { width: null, height: null };
}
