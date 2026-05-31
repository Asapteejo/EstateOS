type PdfImage = {
  bytes: Buffer;
  width: number;
  height: number;
  format: "jpeg";
};

export type ContractPdfPayload = {
  contractNumber: string;
  generatedDate: string;
  company: {
    name: string;
    legalName: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  buyer: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  property: {
    title: string;
    unitTitle: string | null;
    location: string | null;
  };
  payment: {
    reference: string;
    amount: string;
    currency: string;
    paidAt: string;
  };
  signatory: {
    name: string;
    title: string;
  };
  terms: string;
  footerLegalText: string | null;
  signatureImage?: PdfImage | null;
  stampImage?: PdfImage | null;
};

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function wrapText(value: string, maxChars = 92) {
  const words = normalizeWhitespace(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

class PdfBuilder {
  private objects: Buffer[] = [];
  private content: string[] = [];

  private addObject(value: string | Buffer) {
    this.objects.push(Buffer.isBuffer(value) ? value : Buffer.from(value, "binary"));
    return this.objects.length;
  }

  text(value: string, x: number, y: number, size = 10) {
    this.content.push(`BT /F1 ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`);
  }

  line(x1: number, y1: number, x2: number, y2: number) {
    this.content.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  }

  rect(x: number, y: number, width: number, height: number) {
    this.content.push(`${x} ${y} ${width} ${height} re S`);
  }

  image(name: string, x: number, y: number, width: number, height: number) {
    this.content.push(`q ${width} 0 0 ${height} ${x} ${y} cm /${name} Do Q`);
  }

  build(images: Array<{ name: string; image: PdfImage }>) {
    const pagesId = 1;
    const fontId = 2;
    const imageObjects = images.map(({ name, image }) => {
      const stream = Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
          "binary",
        ),
        image.bytes,
        Buffer.from("\nendstream", "binary"),
      ]);
      return { name, id: this.addObject(stream) };
    });
    const xObjects = imageObjects.length
      ? `/XObject << ${imageObjects.map((item) => `/${item.name} ${item.id} 0 R`).join(" ")} >>`
      : "";
    const contentStream = this.content.join("\n");
    const contentId = this.addObject(
      `<< /Length ${Buffer.byteLength(contentStream, "binary")} >>\nstream\n${contentStream}\nendstream`,
    );
    const pageId = this.addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> ${xObjects} >> /Contents ${contentId} 0 R >>`,
    );
    this.objects[pagesId - 1] = Buffer.from(`<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`, "binary");
    this.objects[fontId - 1] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "binary");
    const catalogId = this.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "binary")];
    const offsets: number[] = [0];
    for (let index = 0; index < this.objects.length; index += 1) {
      offsets.push(Buffer.concat(chunks).length);
      chunks.push(Buffer.from(`${index + 1} 0 obj\n`, "binary"), this.objects[index], Buffer.from("\nendobj\n", "binary"));
    }
    const xrefOffset = Buffer.concat(chunks).length;
    chunks.push(Buffer.from(`xref\n0 ${this.objects.length + 1}\n0000000000 65535 f \n`, "binary"));
    for (const offset of offsets.slice(1)) {
      chunks.push(Buffer.from(`${String(offset).padStart(10, "0")} 00000 n \n`, "binary"));
    }
    chunks.push(
      Buffer.from(
        `trailer\n<< /Size ${this.objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
        "binary",
      ),
    );
    return Buffer.concat(chunks);
  }

  constructor() {
    this.addObject("");
    this.addObject("");
  }
}

function drawParagraph(pdf: PdfBuilder, text: string, x: number, startY: number, options?: { size?: number; maxChars?: number; lineHeight?: number }) {
  const size = options?.size ?? 10;
  const lineHeight = options?.lineHeight ?? 14;
  let y = startY;
  for (const line of wrapText(text, options?.maxChars ?? 92)) {
    pdf.text(line, x, y, size);
    y -= lineHeight;
  }
  return y;
}

export function renderContractPdf(payload: ContractPdfPayload) {
  const pdf = new PdfBuilder();
  let y = 750;

  pdf.text("CONTRACT OF SALE", 56, y, 20);
  pdf.text(payload.contractNumber, 410, y + 3, 10);
  y -= 22;
  pdf.line(56, y, 556, y);
  y -= 26;

  pdf.text(payload.company.legalName ?? payload.company.name, 56, y, 13);
  y -= 17;
  pdf.text(`Generated: ${payload.generatedDate}`, 56, y, 10);
  y -= 14;
  pdf.text(`Address: ${payload.company.address ?? "Not configured"}`, 56, y, 9);
  y -= 13;
  pdf.text(`Contact: ${payload.company.email ?? "Not configured"}${payload.company.phone ? ` / ${payload.company.phone}` : ""}`, 56, y, 9);
  y -= 26;

  pdf.rect(56, y - 90, 500, 95);
  pdf.text("Buyer Details", 70, y - 18, 12);
  pdf.text(`Name: ${payload.buyer.name}`, 70, y - 38, 10);
  pdf.text(`Email: ${payload.buyer.email ?? "Not configured"}`, 70, y - 54, 10);
  pdf.text(`Phone: ${payload.buyer.phone ?? "Not configured"}`, 70, y - 70, 10);
  y -= 118;

  pdf.rect(56, y - 100, 500, 105);
  pdf.text("Property Details", 70, y - 18, 12);
  pdf.text(`Property: ${payload.property.title}`, 70, y - 38, 10);
  pdf.text(`Unit: ${payload.property.unitTitle ?? "Not applicable"}`, 70, y - 54, 10);
  pdf.text(`Location: ${payload.property.location ?? "Not configured"}`, 70, y - 70, 10);
  y -= 128;

  pdf.rect(56, y - 100, 500, 105);
  pdf.text("Payment Details", 70, y - 18, 12);
  pdf.text(`Reference: ${payload.payment.reference}`, 70, y - 38, 10);
  pdf.text(`Amount: ${payload.payment.amount}`, 70, y - 54, 10);
  pdf.text(`Currency: ${payload.payment.currency}`, 70, y - 70, 10);
  pdf.text(`Paid at: ${payload.payment.paidAt}`, 70, y - 86, 10);
  y -= 128;

  pdf.text("Contract Terms", 56, y, 12);
  y -= 18;
  y = drawParagraph(pdf, payload.terms, 56, y, { maxChars: 95, size: 9, lineHeight: 13 });
  y -= 20;

  pdf.line(56, y, 236, y);
  pdf.line(336, y, 516, y);
  pdf.text(payload.signatory.name, 56, y - 16, 10);
  pdf.text(payload.signatory.title, 56, y - 31, 9);
  pdf.text("Company stamp", 336, y - 16, 9);

  const images: Array<{ name: string; image: PdfImage }> = [];
  if (payload.signatureImage) {
    images.push({ name: "Sig", image: payload.signatureImage });
    pdf.image("Sig", 70, y + 10, 120, 42);
  }
  if (payload.stampImage) {
    images.push({ name: "Stamp", image: payload.stampImage });
    pdf.image("Stamp", 365, y + 5, 72, 72);
  }

  if (payload.footerLegalText) {
    drawParagraph(pdf, payload.footerLegalText, 56, 55, { maxChars: 110, size: 8, lineHeight: 10 });
  }

  return pdf.build(images);
}

export type { PdfImage };
