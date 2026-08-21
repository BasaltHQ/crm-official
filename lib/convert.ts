/**
 * BasaltLens Deterministic Conversion Engine
 * 
 * Zero-AI file conversion using industry-standard libraries.
 * Every conversion here is deterministic, fast, and free.
 */

import sharp, { type FormatEnum, type AvailableFormatInfo } from "sharp";
import * as ExcelJS from "exceljs";
import { parse as csvParse } from "csv-parse/sync";
import mammoth from "mammoth";
import TurndownService from "turndown";
import { marked } from "marked";
import * as YAML from "yaml";

// ── Types ──

export interface ConversionResult {
    buffer: Buffer;
    mimeType: string;
    extension: string;
}

type ConvertFn = (input: Buffer, fileName?: string) => Promise<ConversionResult>;

// ── Image Conversions (sharp) ──

const imgConvert = (format: keyof FormatEnum | AvailableFormatInfo, mime: string, ext: string): ConvertFn =>
    async (input) => ({
        buffer: await sharp(input).toFormat(format).toBuffer(),
        mimeType: mime,
        extension: ext,
    });

const toWebP = imgConvert("webp", "image/webp", ".webp");
const toPng = imgConvert("png", "image/png", ".png");
const toJpg: ConvertFn = async (input) => ({
    buffer: await sharp(input).jpeg({ quality: 92 }).toBuffer(),
    mimeType: "image/jpeg",
    extension: ".jpg",
});
const toTiff = imgConvert("tiff", "image/tiff", ".tiff");
const toBmp: ConvertFn = async (input) => ({
    // sharp doesn't support BMP output natively; convert to PNG
    buffer: await sharp(input).png().toBuffer(),
    mimeType: "image/png",
    extension: ".png",
});

// SVG → raster
const svgToRaster = (format: "png" | "jpeg" | "webp"): ConvertFn =>
    async (input) => {
        const fmt = format === "jpeg" ? "jpg" : format;
        const mime = format === "jpeg" ? "image/jpeg" : `image/${format}`;
        return {
            buffer: await sharp(input).toFormat(format).toBuffer(),
            mimeType: mime,
            extension: `.${fmt}`,
        };
    };

// ── CSV ↔ JSON ──

const csvToJson: ConvertFn = async (input) => {
    const records = csvParse(input, { columns: true, skip_empty_lines: true, trim: true });
    return {
        buffer: Buffer.from(JSON.stringify(records, null, 2), "utf-8"),
        mimeType: "application/json",
        extension: ".json",
    };
};

const jsonToCsv: ConvertFn = async (input) => {
    const data = JSON.parse(input.toString("utf-8"));
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return { buffer: Buffer.from(""), mimeType: "text/csv", extension: ".csv" };

    const headers = Array.from(new Set(rows.flatMap((r: any) => Object.keys(r))));
    const csvLines = [
        headers.map(h => `"${h}"`).join(","),
        ...rows.map(row =>
            headers.map(h => {
                const val = String(row[h] ?? "").replace(/"/g, '""');
                return `"${val}"`;
            }).join(",")
        ),
    ];
    return {
        buffer: Buffer.from(csvLines.join("\n"), "utf-8"),
        mimeType: "text/csv",
        extension: ".csv",
    };
};

// ── CSV ↔ XLSX ──

const csvToXlsx: ConvertFn = async (input) => {
    const records = csvParse(input, { columns: true, skip_empty_lines: true, trim: true });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    if (records.length > 0) {
        const headers = Object.keys(records[0] as Record<string, unknown>);
        ws.columns = headers.map(h => ({ header: h, key: h, width: Math.max(12, h.length + 4) }));
        records.forEach((row: any) => ws.addRow(row));
        ws.getRow(1).font = { bold: true };
        ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    }
    return {
        buffer: Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer),
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: ".xlsx",
    };
};

const xlsxToCsv: ConvertFn = async (input) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(input as any);
    const ws = wb.worksheets[0];
    if (!ws) return { buffer: Buffer.from(""), mimeType: "text/csv", extension: ".csv" };

    const lines: string[] = [];
    ws.eachRow((row) => {
        const vals = (row.values as any[]).slice(1).map(v => {
            const s = String(v ?? "").replace(/"/g, '""');
            return `"${s}"`;
        });
        lines.push(vals.join(","));
    });
    return { buffer: Buffer.from(lines.join("\n"), "utf-8"), mimeType: "text/csv", extension: ".csv" };
};

// ── XLSX ↔ JSON ──

const xlsxToJson: ConvertFn = async (input) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(input as any);
    const ws = wb.worksheets[0];
    if (!ws || ws.rowCount < 2) return { buffer: Buffer.from("[]"), mimeType: "application/json", extension: ".json" };

    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNum) => { headers[colNum - 1] = String(cell.value ?? `Column${colNum}`); });

    const rows: Record<string, any>[] = [];
    for (let i = 2; i <= ws.rowCount; i++) {
        const row = ws.getRow(i);
        const obj: Record<string, any> = {};
        headers.forEach((h, idx) => { obj[h] = row.getCell(idx + 1).value ?? ""; });
        rows.push(obj);
    }
    return { buffer: Buffer.from(JSON.stringify(rows, null, 2), "utf-8"), mimeType: "application/json", extension: ".json" };
};

const jsonToXlsx: ConvertFn = async (input) => {
    const data = JSON.parse(input.toString("utf-8"));
    const rows = Array.isArray(data) ? data : [data];
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    if (rows.length > 0) {
        const headers = Array.from(new Set(rows.flatMap((r: any) => Object.keys(r))));
        ws.columns = headers.map(h => ({ header: h, key: h, width: Math.max(12, h.length + 4) }));
        rows.forEach(row => ws.addRow(row));
        ws.getRow(1).font = { bold: true };
    }
    return {
        buffer: Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer),
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: ".xlsx",
    };
};

// ── JSON ↔ YAML ──

const jsonToYaml: ConvertFn = async (input) => ({
    buffer: Buffer.from(YAML.stringify(JSON.parse(input.toString("utf-8"))), "utf-8"),
    mimeType: "text/yaml",
    extension: ".yaml",
});

const yamlToJson: ConvertFn = async (input) => ({
    buffer: Buffer.from(JSON.stringify(YAML.parse(input.toString("utf-8")), null, 2), "utf-8"),
    mimeType: "application/json",
    extension: ".json",
});

// ── JSON/YAML ↔ XML ──

const jsonToXml: ConvertFn = async (input) => {
    const data = JSON.parse(input.toString("utf-8"));
    const toXmlStr = (obj: any, indent = ""): string => {
        if (Array.isArray(obj)) return obj.map(item => `${indent}<item>\n${toXmlStr(item, indent + "  ")}${indent}</item>\n`).join("");
        if (typeof obj === "object" && obj !== null) {
            return Object.entries(obj).map(([k, v]) => {
                const tag = k.replace(/[^a-zA-Z0-9_]/g, "_");
                if (typeof v === "object" && v !== null) return `${indent}<${tag}>\n${toXmlStr(v, indent + "  ")}${indent}</${tag}>\n`;
                return `${indent}<${tag}>${String(v ?? "")}</${tag}>\n`;
            }).join("");
        }
        return `${indent}${String(obj)}\n`;
    };
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n${toXmlStr(data, "  ")}</root>`;
    return { buffer: Buffer.from(xml, "utf-8"), mimeType: "application/xml", extension: ".xml" };
};

const xmlToJson: ConvertFn = async (input) => {
    // Simple XML parser for common cases
    const text = input.toString("utf-8");
    const { XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
    const result = parser.parse(text);
    return { buffer: Buffer.from(JSON.stringify(result, null, 2), "utf-8"), mimeType: "application/json", extension: ".json" };
};

const yamlToXml: ConvertFn = async (input) => {
    const data = YAML.parse(input.toString("utf-8"));
    const jsonBuf = Buffer.from(JSON.stringify(data), "utf-8");
    return jsonToXml(jsonBuf);
};

const xmlToCsv: ConvertFn = async (input) => {
    const jsonResult = await xmlToJson(input);
    return jsonToCsv(jsonResult.buffer);
};

const xmlToYaml: ConvertFn = async (input) => {
    const jsonResult = await xmlToJson(input);
    return jsonToYaml(jsonResult.buffer);
};

// ── DOCX Conversions (mammoth) ──

const docxToHtml: ConvertFn = async (input) => {
    const result = await mammoth.convertToHtml({ buffer: input });
    const html = `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>Converted</title></head>\n<body>\n${result.value}\n</body>\n</html>`;
    return { buffer: Buffer.from(html, "utf-8"), mimeType: "text/html", extension: ".html" };
};

const docxToMarkdown: ConvertFn = async (input) => {
    const result = await mammoth.convertToHtml({ buffer: input });
    const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
    const md = td.turndown(result.value);
    return { buffer: Buffer.from(md, "utf-8"), mimeType: "text/markdown", extension: ".md" };
};

const docxToText: ConvertFn = async (input) => {
    const result = await mammoth.extractRawText({ buffer: input });
    return { buffer: Buffer.from(result.value, "utf-8"), mimeType: "text/plain", extension: ".txt" };
};

const docxToJson: ConvertFn = async (input) => {
    const result = await mammoth.extractRawText({ buffer: input });
    const paragraphs = result.value.split("\n").filter(Boolean);
    return {
        buffer: Buffer.from(JSON.stringify({ paragraphs, text: result.value }, null, 2), "utf-8"),
        mimeType: "application/json",
        extension: ".json",
    };
};

// ── Markdown ↔ HTML ──

const markdownToHtml: ConvertFn = async (input) => {
    const html = await marked(input.toString("utf-8"));
    const full = `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>Converted</title>\n<style>body{font-family:system-ui;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}code{background:#f0f0f0;padding:2px 6px;border-radius:3px}pre code{display:block;padding:1rem;overflow-x:auto}</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;
    return { buffer: Buffer.from(full, "utf-8"), mimeType: "text/html", extension: ".html" };
};

const htmlToMarkdown: ConvertFn = async (input) => {
    const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
    const md = td.turndown(input.toString("utf-8"));
    return { buffer: Buffer.from(md, "utf-8"), mimeType: "text/markdown", extension: ".md" };
};

const htmlToText: ConvertFn = async (input) => {
    const text = input.toString("utf-8").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return { buffer: Buffer.from(text, "utf-8"), mimeType: "text/plain", extension: ".txt" };
};

const markdownToText: ConvertFn = async (input) => {
    const html = await marked(input.toString("utf-8"));
    return htmlToText(Buffer.from(html, "utf-8"));
};

// ── Text conversions ──

const txtToMd: ConvertFn = async (input) => ({
    buffer: input,
    mimeType: "text/markdown",
    extension: ".md",
});

const txtToHtml: ConvertFn = async (input) => {
    const paragraphs = input.toString("utf-8").split("\n\n").filter(Boolean);
    const html = `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>Converted</title></head>\n<body>\n${paragraphs.map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("\n")}\n</body>\n</html>`;
    return { buffer: Buffer.from(html, "utf-8"), mimeType: "text/html", extension: ".html" };
};

// ── CSV ↔ YAML/XML ──

const csvToYaml: ConvertFn = async (input) => {
    const jsonResult = await csvToJson(input);
    return jsonToYaml(jsonResult.buffer);
};

const csvToXml: ConvertFn = async (input) => {
    const jsonResult = await csvToJson(input);
    return jsonToXml(jsonResult.buffer);
};

const csvToHtml: ConvertFn = async (input) => {
    const records = csvParse(input, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    if (records.length === 0) return { buffer: Buffer.from("<p>Empty</p>"), mimeType: "text/html", extension: ".html" };
    const headers = Object.keys(records[0] as Record<string, string>);
    const thead = `<tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>`;
    const tbody = records.map(r => `<tr>${headers.map(h => `<td>${r[h] ?? ""}</td>`).join("")}</tr>`).join("\n");
    const html = `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>Table</title>\n<style>body{font-family:system-ui;margin:2rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px}th{background:#1a1a1a;color:#fff}tr:nth-child(even){background:#f9f9f9}</style>\n</head>\n<body>\n<table>\n<thead>${thead}</thead>\n<tbody>\n${tbody}\n</tbody>\n</table>\n</body>\n</html>`;
    return { buffer: Buffer.from(html, "utf-8"), mimeType: "text/html", extension: ".html" };
};

// ── XLSX to HTML/XML/YAML/Markdown ──

const xlsxToHtml: ConvertFn = async (input) => {
    const jsonResult = await xlsxToJson(input);
    const csvBuf = (await jsonToCsv(jsonResult.buffer)).buffer;
    return csvToHtml(csvBuf);
};

const xlsxToXml: ConvertFn = async (input) => {
    const jsonResult = await xlsxToJson(input);
    return jsonToXml(jsonResult.buffer);
};

const xlsxToYaml: ConvertFn = async (input) => {
    const jsonResult = await xlsxToJson(input);
    return jsonToYaml(jsonResult.buffer);
};

const xlsxToMd: ConvertFn = async (input) => {
    const jsonResult = await xlsxToJson(input);
    const records = JSON.parse(jsonResult.buffer.toString("utf-8")) as Record<string, any>[];
    if (records.length === 0) return { buffer: Buffer.from("*Empty spreadsheet*"), mimeType: "text/markdown", extension: ".md" };
    const headers = Object.keys(records[0]);
    const headerRow = `| ${headers.join(" | ")} |`;
    const separator = `| ${headers.map(() => "---").join(" | ")} |`;
    const dataRows = records.map(r => `| ${headers.map(h => String(r[h] ?? "")).join(" | ")} |`);
    const md = [headerRow, separator, ...dataRows].join("\n");
    return { buffer: Buffer.from(md, "utf-8"), mimeType: "text/markdown", extension: ".md" };
};

// ── Master Conversion Registry ──

const CONVERSIONS: Record<string, Record<string, ConvertFn>> = {
    // Image conversions
    PNG:  { JPG: toJpg, WEBP: toWebP, TIFF: toTiff, BMP: toBmp },
    JPG:  { PNG: toPng, WEBP: toWebP, TIFF: toTiff, BMP: toBmp },
    WEBP: { PNG: toPng, JPG: toJpg, TIFF: toTiff },
    TIFF: { PNG: toPng, JPG: toJpg, WEBP: toWebP },
    BMP:  { PNG: toPng, JPG: toJpg, WEBP: toWebP },
    SVG:  { PNG: svgToRaster("png"), JPG: svgToRaster("jpeg"), WEBP: svgToRaster("webp") },
    HEIC: { PNG: toPng, JPG: toJpg, WEBP: toWebP },

    // Spreadsheet
    CSV:  { XLSX: csvToXlsx, JSON: csvToJson, HTML: csvToHtml, XML: csvToXml, YAML: csvToYaml },
    XLSX: { CSV: xlsxToCsv, JSON: xlsxToJson, HTML: xlsxToHtml, MD: xlsxToMd, XML: xlsxToXml, YAML: xlsxToYaml },

    // Data
    JSON: { CSV: jsonToCsv, XLSX: jsonToXlsx, XML: jsonToXml, YAML: jsonToYaml, TXT: async (i) => ({ buffer: Buffer.from(JSON.stringify(JSON.parse(i.toString()), null, 2)), mimeType: "text/plain", extension: ".txt" }), HTML: async (i) => csvToHtml((await jsonToCsv(i)).buffer) },
    YAML: { JSON: yamlToJson, XML: yamlToXml, TXT: async (i) => ({ buffer: i, mimeType: "text/plain", extension: ".txt" }) },
    XML:  { JSON: xmlToJson, CSV: xmlToCsv, HTML: async (i) => csvToHtml((await xmlToCsv(i)).buffer), TXT: async (i) => { const j = await xmlToJson(i); return htmlToText(Buffer.from(JSON.stringify(JSON.parse(j.buffer.toString("utf-8"))))); }, YAML: xmlToYaml },

    // Documents
    DOCX: { HTML: docxToHtml, MD: docxToMarkdown, TXT: docxToText, JSON: docxToJson },

    // Markup
    HTML: { MD: htmlToMarkdown, TXT: htmlToText },
    MD:   { HTML: markdownToHtml, TXT: markdownToText },

    // Plain text
    TXT:  { MD: txtToMd, HTML: txtToHtml },
};

// ── Public API ──

export function getAvailableTargets(from: string): string[] {
    return Object.keys(CONVERSIONS[from] || {});
}

export function isConversionSupported(from: string, to: string): boolean {
    return !!CONVERSIONS[from]?.[to];
}

export async function convertFile(
    input: Buffer,
    from: string,
    to: string,
    fileName?: string
): Promise<ConversionResult> {
    const fn = CONVERSIONS[from]?.[to];
    if (!fn) {
        throw new Error(`Conversion ${from} -> ${to} is not supported`);
    }
    return fn(input, fileName);
}

export function getAllSupportedConversions(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [from, targets] of Object.entries(CONVERSIONS)) {
        result[from] = Object.keys(targets);
    }
    return result;
}
